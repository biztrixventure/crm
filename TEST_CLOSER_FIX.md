# 🧪 Testing Guide - Closer Selection Fix

**Commit:** 3dfee8a
**What to Test:** Cross-company closer filtering

---

## ✅ Quick Test (5 minutes)

### Setup
1. Have TWO companies set up in production/staging
2. Have AT LEAST one closer in each company
3. Be logged in as a frontal from Company A

### Test Steps

#### Test 1: Verify Only Company Closers Appear
```
1. Open browser DevTools (F12)
2. Go to Console tab
3. Make API call:
   fetch('/api/v1/users/closers/list')
     .then(r => r.json())
     .then(d => console.log(d))

Expected: Only see closers from YOUR company
NOT: Closers from other companies
```

#### Test 2: Verify Transfer Form Dropdown
```
1. Go to: /transfer/create (or transfer form)
2. Look at "Select Closer" dropdown
3. Expand dropdown
4. Count closers shown

Expected: Only closers from your company
NOT: Closers from other companies
```

#### Test 3: Submit Transfer Successfully
```
1. Select any closer from dropdown
2. Fill in other form fields (name, phone, etc.)
3. Click "Submit Transfer"
4. Wait for response

Expected: Transfer created successfully ✅
NOT: "Closer not found" error ❌
```

#### Test 4: Verify No 404 Errors
```
1. Open DevTools Network tab
2. Refresh page
3. Go to transfer form
4. Look for requests to: /api/v1/users/closers/list

Expected: Status 200 ✅
NOT: Status 404 ❌
```

---

## 🔍 Advanced Testing (if debugging)

### Check API Directly
```bash
# First, get an auth token by logging in
TOKEN="your_auth_token_here"

# Test the endpoint from terminal
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain/api/v1/users/closers/list

# Should return only your company's closers:
{
  "closers": [
    {
      "id": "uuid-1",
      "full_name": "Closer Name",
      "email": "closer@company.com"
    }
  ]
}
```

### Check Database Query
```sql
-- Query: What closers are returned for a specific company?
SELECT id, full_name, email, role, company_id, is_active
FROM users
WHERE role = 'closer'
AND company_id = 'your-company-id'
AND is_active = true
ORDER BY full_name;
```

### Browser Console Test
```javascript
// In browser, test the auth state
localStorage.getItem('auth_token')  // Should have token
sessionStorage.getItem('user_company_id')  // Should have company ID

// Test the API call
const res = await fetch('/api/v1/users/closers/list');
const data = await res.json();
console.log('Closers returned:', data.closers.length);
```

---

## ❌ Common Issues and Solutions

### Issue 1: Still Seeing Other Companies' Closers
**Cause:** Old code cached or not redeployed
**Solution:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check API service restarted
4. Verify commit 3dfee8a deployed

### Issue 2: Empty Closer List
**Cause:** No closers in your company
**Solution:**
1. Create a closer in your company first
2. Make sure closer has `is_active = true`
3. Make sure closer has correct `company_id`

### Issue 3: 401 Unauthorized on /users/closers/list
**Cause:** Auth token not sent
**Solution:**
1. Check you're logged in
2. Check token in localStorage
3. Verify Authorization header being sent

### Issue 4: 500 Error on Endpoint
**Cause:** Database query error
**Solution:**
1. Check API logs for error details
2. Verify company_id in req.user is correct
3. Restart API service

---

## ✅ Success Indicators

After testing, you should see:

✅ **Dropdown shows fewer closers** - Only your company's closers
✅ **API returns 200 status** - Not 404 or 500
✅ **Transfer submits successfully** - No "Closer not found" error
✅ **Console has no errors** - Clean network requests
✅ **Company isolation working** - Can't select other companies' closers

---

## 📝 Test Checklist

- [ ] Logged in as frontal user
- [ ] Can access transfer form
- [ ] Closer dropdown loads
- [ ] Can see own company's closers
- [ ] CANNOT see other companies' closers
- [ ] Can select and submit transfer
- [ ] Transfer created successfully
- [ ] Browser console clean (no errors)
- [ ] DevTools Network shows 200 responses
- [ ] No "Closer not found" errors

---

## 🚀 After Testing

If all tests pass:
1. ✅ Fix is working correctly
2. ✅ Safe to monitor in production
3. ✅ Users should experience no issues
4. ✅ Transfer creation flow is restored

If any test fails:
1. ❌ Note the specific failing test
2. ❌ Check the "Common Issues" section above
3. ❌ Review API logs for error details
4. ❌ Consider rolling back if necessary

---

## 📊 Performance Test

The fix should have no performance impact:

**Before:** Query ALL closers from ALL companies
**After:** Query closers from ONE company

**Result:** ✅ FASTER - Smaller dataset returned

No additional database queries added, so zero performance regression.

---

## 🎯 Summary

**What's Being Tested:** Closer endpoint now filters by company_id
**Expected Behavior:** Only own company's closers shown
**Success Metric:** Transfer creation succeeds
**Timeline:** 5-10 minutes to complete

Test now and confirm the fix is working! 🚀
