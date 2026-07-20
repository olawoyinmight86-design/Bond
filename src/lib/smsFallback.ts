// When a text message has been sitting in the offline outbox for a while,
// the phone likely has cell signal but no data (or is somewhere wifi/data
// can't reach). Real SMS still works there. A web app can't send an SMS
// silently — no browser allows that — but it can open the native Messages
// app with everything pre-filled, so it's one tap instead of retyping.
export function buildSmsFallbackLink(phoneNumber: string, message: string): string {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const body = encodeURIComponent(message);
  // iOS uses & before body, Android/most others use ?
  return isIOS ? `sms:${phoneNumber}&body=${body}` : `sms:${phoneNumber}?body=${body}`;
}

export const STUCK_THRESHOLD_ATTEMPTS = 3; // ~45s of failed retries at the 15s interval
