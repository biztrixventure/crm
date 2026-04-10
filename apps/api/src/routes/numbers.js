import { Router } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import supabase from '../services/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assignNumbersSchema } from '../schemas/number.schema.js';
import { logAuditEvent } from '../services/audit.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// POST /numbers/upload - Upload CSV/XLSX (Company Admin only)
router.post(
  '/upload',
  roleGuard('company_admin', 'super_admin'),
  upload.single('file'),
  async (req, res) => {
    const { companyId, id: userId, role } = req.user;
    const targetCompanyId = role === 'super_admin' && req.body.company_id 
      ? req.body.company_id 
      : companyId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // Parse file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Extract phone numbers (skip header if first row is non-numeric)
      let phoneNumbers = [];
      let startRow = 0;

      // Check if first row is a header
      if (data[0] && data[0][0] && !/^\d+$/.test(String(data[0][0]).replace(/\D/g, ''))) {
        startRow = 1;
      }

      for (let i = startRow; i < data.length; i++) {
        const row = data[i];
        if (row && row[0]) {
          const phone = String(row[0]).replace(/\D/g, '');
          if (phone.length >= 10) {
            phoneNumbers.push(phone);
          }
        }
      }

      if (phoneNumbers.length === 0) {
        return res.status(422).json({ error: 'No valid phone numbers found in file' });
      }

      // Create number list record
      const { data: numberList, error: listError } = await supabase
        .from('number_lists')
        .insert({
          company_id: targetCompanyId,
          uploaded_by: userId,
          file_name: req.file.originalname,
          total_numbers: phoneNumbers.length,
        })
        .select()
        .single();

      if (listError) throw listError;

      // Bulk insert numbers
      const numbersToInsert = phoneNumbers.map((phone, index) => ({
        list_id: numberList.id,
        company_id: targetCompanyId,
        phone_number: phone,
        row_order: index,
      }));

      // Insert in batches of 1000
      const batchSize = 1000;
      for (let i = 0; i < numbersToInsert.length; i += batchSize) {
        const batch = numbersToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('assigned_numbers')
          .insert(batch);
        
        if (insertError) throw insertError;
      }

      res.status(201).json({
        list: numberList,
        totalNumbers: phoneNumbers.length,
        message: `Successfully uploaded ${phoneNumbers.length} numbers`,
      });
    } catch (err) {
      console.error('Number upload error:', err);
      res.status(500).json({ error: 'Failed to upload numbers' });
    }
  }
);

// GET /numbers/lists - Get all number lists for company
router.get('/lists', async (req, res) => {
  const { companyId, role } = req.user;
  const { company_id } = req.query;

  try {
    let query = supabase
      .from('number_lists')
      .select(`
        *,
        uploaded_by_user:users!number_lists_uploaded_by_fkey (full_name)
      `)
      .order('created_at', { ascending: false });

    if (role === 'company_admin') {
      query = query.eq('company_id', companyId);
    } else if (company_id) {
      query = query.eq('company_id', company_id);
    }

    const { data: lists, error } = await query;

    if (error) throw error;

    // Get assignment stats for each list
    const listsWithStats = await Promise.all(
      lists.map(async (list) => {
        const { count: assigned } = await supabase
          .from('assigned_numbers')
          .select('id', { count: 'exact', head: true })
          .eq('list_id', list.id)
          .not('fronter_id', 'is', null);

        return {
          ...list,
          assignedCount: assigned || 0,
          unassignedCount: list.total_numbers - (assigned || 0),
        };
      })
    );

    res.json({ lists: listsWithStats });
  } catch (err) {
    console.error('Get number lists error:', err);
    res.status(500).json({ error: 'Failed to fetch number lists' });
  }
});

// GET /numbers/lists/:id - Get numbers from a specific list
router.get('/lists/:id', async (req, res) => {
  const { id } = req.params;
  const { companyId, role } = req.user;
  const { fronter_id, assigned, page = 1, limit = 50 } = req.query;

  try {
    // Verify list belongs to company
    const { data: list, error: listError } = await supabase
      .from('number_lists')
      .select('*')
      .eq('id', id)
      .single();

    if (listError || !list) {
      return res.status(404).json({ error: 'Number list not found' });
    }

    if (role === 'company_admin' && list.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = supabase
      .from('assigned_numbers')
      .select(`
        *,
        fronter:users!assigned_numbers_fronter_id_fkey (id, full_name)
      `, { count: 'exact' })
      .eq('list_id', id)
      .order('row_order');

    if (fronter_id) {
      query = query.eq('fronter_id', fronter_id);
    }

    if (assigned === 'true') {
      query = query.not('fronter_id', 'is', null);
    } else if (assigned === 'false') {
      query = query.is('fronter_id', null);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: numbers, error, count } = await query;

    if (error) throw error;

    res.json({
      list,
      numbers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get numbers error:', err);
    res.status(500).json({ error: 'Failed to fetch numbers' });
  }
});

// POST /numbers/assign - Assign numbers to fronter
router.post('/assign', validate(assignNumbersSchema), async (req, res) => {
  const { list_id, fronter_id, from_row, to_row } = req.body;
  const { companyId, role, id: userId } = req.user;

  try {
    // Verify list belongs to company
    const { data: list, error: listError } = await supabase
      .from('number_lists')
      .select('id, company_id')
      .eq('id', list_id)
      .single();

    if (listError || !list) {
      return res.status(404).json({ error: 'Number list not found' });
    }

    if (role === 'company_admin' && list.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify fronter belongs to company and is a fronter
    const { data: fronter, error: fronterError } = await supabase
      .from('users')
      .select('id, role, company_id')
      .eq('id', fronter_id)
      .single();

    if (fronterError || !fronter) {
      return res.status(404).json({ error: 'Fronter not found' });
    }

    if (fronter.role !== 'fronter') {
      return res.status(422).json({ error: 'User is not a fronter' });
    }

    if (fronter.company_id !== list.company_id) {
      return res.status(422).json({ error: 'Fronter does not belong to this company' });
    }

    // Update assignments (row_order is 0-indexed)
    const { data: updated, error: updateError } = await supabase
      .from('assigned_numbers')
      .update({ fronter_id })
      .eq('list_id', list_id)
      .gte('row_order', from_row - 1)
      .lte('row_order', to_row - 1)
      .select('id');

    if (updateError) throw updateError;

    // Log assignment
    await logAuditEvent({
      userId,
      event: 'number_assignment',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        list_id,
        fronter_id,
        from_row,
        to_row,
        count: updated.length,
      },
    });

    res.json({
      message: `Assigned ${updated.length} numbers to fronter`,
      assignedCount: updated.length,
    });
  } catch (err) {
    console.error('Assign numbers error:', err);
    res.status(500).json({ error: 'Failed to assign numbers' });
  }
});

// GET /numbers/my - Get numbers assigned to current fronter
router.get('/my', async (req, res) => {
  const { id: userId } = req.user;
  const { page = 1, limit = 50 } = req.query;

  try {
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data: numbers, error, count } = await supabase
      .from('assigned_numbers')
      .select(`
        *,
        number_lists (id, file_name, created_at)
      `, { count: 'exact' })
      .eq('fronter_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      numbers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get my numbers error:', err);
    res.status(500).json({ error: 'Failed to fetch numbers' });
  }
});

export default router;
