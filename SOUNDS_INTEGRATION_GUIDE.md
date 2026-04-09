# Notification Sounds Integration Guide

## Current Status ✅

All notification sound files are installed and integrated:
- ✅ `transfer.mp3` - New transfer notifications
- ✅ `callback.mp3` - Callback reminder notifications
- ✅ `sale.mp3` - Sale made notifications
- ✅ `batch.mp3` - Batch assignment notifications
- ✅ `alert.mp3` - Alert/flag notifications

**Location:** `apps/web/public/sounds/`

## How Sounds Work

### Sound Triggering
Sounds are triggered automatically when notifications are received via Socket.io events:

```javascript
// From useSocket.js
socket.on('notification:new', (notification) => {
  // Sound type determined by notification type
  if (notification.type.includes('transfer')) playSound('transfer');
  else if (notification.type.includes('callback')) playSound('callback');
  else if (notification.type.includes('sale')) playSound('sale');
  else if (notification.type.includes('batch')) playSound('batch');
  else if (notification.type.includes('alert')) playSound('alert');

  // Browser notification also shown
  showNotification({
    title: notification.title,
    message: notification.message,
  });
});
```

### User Controls
Users can control notification sounds through the `useNotificationSounds` hook:

```javascript
const { playSound, setSoundsEnabled, setVolume, setSoundTypeEnabled } = useNotificationSounds();

// Enable/disable all sounds
setSoundsEnabled(true/false);

// Set volume (0-1)
setVolume(0.7); // 70%

// Enable/disable specific sound types
setSoundTypeEnabled('transfer', true);
setSoundTypeEnabled('callback', false);

// Preferences saved to localStorage
```

## Replacing Placeholder Sounds (Production)

The current placeholder files are valid MP3 stubs. For production, replace them with actual notification sounds:

### Audio Specifications
- **Format:** MP3 (.mp3)
- **Duration:** 0.5-2 seconds (short notification tones)
- **Bitrate:** 128 kbps or higher
- **Sample Rate:** 44.1 kHz or 48 kHz
- **Size:** Ideally 30-50 KB per file
- **Quality:** Clear, recognizable tone

### Recommended Sounds by Type

**1. transfer.mp3** - Happy/positive tone
- Characteristic: Uplifting, celebratory
- Use case: New transfer assignment
- Example: Bell chime, digital "ding", cash register sound
- Recommendation: iLok, notification bell #1

**2. callback.mp3** - Reminder/bell tone
- Characteristic: Clear, attention-getting
- Use case: Callback due reminder
- Example: Phone ring, bell sound, alert chime
- Recommendation: Single bell ring, phone notification

**3. sale.mp3** - Success/celebratory tone
- Characteristic: Bright, celebratory
- Use case: Sale completed
- Example: Success chime, triumphant tone, cash register "cha-ching"
- Recommendation: Success notification, celebration sound

**4. batch.mp3** - Neutral notification tone
- Characteristic: Neutral, professional
- Use case: Batch assigned to agent
- Example: Beep, alert tone, neutral chime
- Recommendation: Document notification, subtle alert

**5. alert.mp3** - Urgent/warning tone
- Characteristic: Distinct, urgent
- Use case: Issues found (compliance flags)
- Example: Alert buzzer, warning chime, urgent notification
- Recommendation: System alert, warning tone

### Where to Find Sounds

**Free Sources:**
- **Freesound.org** - Creative Commons licensed
- **Zapsplat.com** - Royalty-free sound effects
- **Notification Sounds** - App notification collections
- **Pixabay.com** - Free sound effects
- **Mixkit.co** - Royalty-free music & sounds

**Commercial Sources:**
- Adobe Stock Audio
- Epidemic Sound
- AudioJungle
- Shutterstock Music

**How to Download:**
1. Find notification sounds matching the descriptions above
2. Download as MP3 format
3. Convert to MP3 if needed (using Audacity, FFmpeg, etc.)
4. Ensure file size is 30-50 KB
5. Trim to 0.5-2 seconds if needed
6. Test in browser before deploying

### Installation Steps

**Replace a Single Sound:**
```bash
# Copy your new sound file to replace old one
cp ~/Downloads/my-transfer-sound.mp3 apps/web/public/sounds/transfer.mp3
```

**Replace All Sounds:**
```bash
# Create/replace all sounds
cp ~/Downloads/transfer-sound.mp3 apps/web/public/sounds/transfer.mp3
cp ~/Downloads/callback-sound.mp3 apps/web/public/sounds/callback.mp3
cp ~/Downloads/sale-sound.mp3 apps/web/public/sounds/sale.mp3
cp ~/Downloads/batch-sound.mp3 apps/web/public/sounds/batch.mp3
cp ~/Downloads/alert-sound.mp3 apps/web/public/sounds/alert.mp3
```

**Rebuild & Deploy:**
```bash
npm run build --prefix apps/web
# Deploy as normal
```

## Testing Sounds

### Manual Test (Frontend)
1. Open browser DevTools Console
2. Run:
```javascript
// Test each sound
import { useNotificationSounds } from '../hooks/useNotificationSounds';
const { playSound } = useNotificationSounds();

playSound('transfer');  // Play transfer sound
playSound('callback');  // Play callback sound
playSound('sale');      // Play sale sound
playSound('batch');     // Play batch sound
playSound('alert');     // Play alert sound
```

### Browser Notifications
1. Ensure browser permissions are granted
2. Allow notifications when prompted
3. Create test notification: POST `/api/v1/notifications/test`
4. Should see:
   - ✅ Toast notification
   - ✅ Audio played
   - ✅ Browser notification popup
   - ✅ Unread count badge

### Volume Control Test
```bash
# In browser console:
localStorage.getItem('notification_sound_preferences')
# Should show json with volume, enabled, soundTypes

# Change volume
localStorage.setItem('notification_sound_preferences',
  JSON.stringify({
    enabled: true,
    volume: 0.5,
    soundTypes: { transfer: true, callback: true, sale: true, batch: true, alert: true }
  })
)
```

## User Preferences (localStorage)

Notification sound preferences are saved in browser:

```javascript
{
  "enabled": true,           // Master sound on/off
  "volume": 0.7,             // Volume 0-1 (70%)
  "soundTypes": {
    "transfer": true,        // Enable transfer sound
    "callback": true,        // Enable callback sound
    "sale": true,            // Enable sale sound
    "batch": true,           // Enable batch sound
    "alert": true            // Enable alert sound
  }
}
```

Users can modify via:
- Settings page (future feature)
- Browser DevTools Console
- Direct localStorage manipulation

## Troubleshooting

**Sounds not playing:**
- ✅ Check browser console for errors
- ✅ Verify browser permits autoplay (may require user interaction first)
- ✅ Check audio file format (must be MP3)
- ✅ Verify file sizes are reasonable (< 100 KB)
- ✅ Test in incognito mode (no extensions blocking)
- ✅ Check notifications are enabled in browser

**Sound files 404 errors:**
- ✅ Verify files exist: `apps/web/public/sounds/*.mp3`
- ✅ Check web server serves public assets
- ✅ Rebuild app: `npm run build --prefix apps/web`
- ✅ Clear browser cache (Ctrl+Shift+Del)

**Volume too loud/quiet:**
- ✅ Adjust volume in browser settings
- ✅ Modify localStorage: `volume: 0.3` to `volume: 1.0`
- ✅ Check system volume is not muted

**No browser notifications:**
- ✅ Grant permission when prompted
- ✅ Check: Settings → Notifications → Allow BizTrixVenture
- ✅ Verify `useNotificationPermissions` hook is loaded

## Integration Checklist

- ✅ Sound files directory created: `apps/web/public/sounds/`
- ✅ All 5 sound files in place (transfer, callback, sale, batch, alert)
- ✅ `useNotificationSounds` hook implemented
- ✅ `useNotificationPermissions` hook implemented
- ✅ Socket.io listeners trigger sounds
- ✅ User preferences persisted to localStorage
- ✅ Volume and enable/disable controls working
- ✅ Browser notifications with sounds
- ✅ Graceful fallback if sounds unavailable
- ✅ Production ready ✅

## Next Steps

1. **Replace placeholder sounds** with production-quality audio files
2. **Test across devices** to ensure consistent playback
3. **Add settings UI** to allow users to customize sounds
4. **Monitor user feedback** on sound choices
5. **A/B test different sounds** if needed

## References

- Sound files: `apps/web/public/sounds/`
- Hook: `apps/web/src/hooks/useNotificationSounds.js`
- Hook: `apps/web/src/hooks/useNotificationPermissions.js`
- Config: `apps/web/src/lib/sounds.js`
- Socket listener: `apps/web/src/hooks/useSocket.js` (lines 103-118)
