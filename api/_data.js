// Questions + quiz window. Answers stay on the server only.
// The open/close time is set from the Admin page (saved in the database).
// If nothing is saved yet, START_DATE / DAYS_OPEN environment variables are the default.
const db = require('./_db');
const PASS_PERCENT = 65;            // pass mark is fixed at 65%
const MAX_ATTEMPTS = 2;             // each roll number gets at most 2 attempts
const DEF_START = new Date(process.env.START_DATE || '2026-10-05T00:00:00+05:30');
const DEF_DAYS = Number(process.env.DAYS_OPEN || 3);

const QUESTIONS = [
  { q: "Phishing mainly used for?", o: ["Improving internet speed", "Protecting computer files", "Stealing information through deception", "Increasing device storage"], a: 2 },
  { q: "Which of the following is the best example of authentication?", o: ["Encrypting a file", "Installing antivirus software", "Connecting to Wi-Fi", "Confirming a user's identity"], a: 3 },
  { q: "What is the main purpose of a firewall?", o: ["Controlling network traffic based on rules", "Increasing computer processing speed", "Recovering deleted files", "Creating stronger passwords"], a: 0 },
  { q: "A student downloads a free game from an unknown website. After installation, the laptop becomes slow, unknown pop-ups appear, and files start behaving strangely. What is the most likely reason?", o: ["The internet connection is temporarily overloaded", "The device may have been infected with malware", "The laptop automatically changed its display settings", "The website may have increased the computer's storage usage"], a: 1 },
  { q: "Which statement about a strong password is most accurate?", o: ["It should contain only numbers", "It should be short and easy to remember", "It should be the same across important accounts", "It should be difficult for others to guess"], a: 3 },
  { q: "A friend sends you a message asking for ₹3,000 urgently. The profile looks normal. What should you do first?", o: ["Verify through another trusted method", "Send the money immediately", "Ask for their password", "Forward the message to other friends"], a: 0 },
  { q: "You receive an email saying your college account will be closed in 15 minutes. It contains a login link. What is the safest action?", o: ["Open the link immediately", "Reply to the email asking for confirmation", "Open the official college portal separately", "Forward the email to your classmates"], a: 2 },
  { q: "A QR code says “Scan to receive ₹500.” After scanning, your payment app asks for your UPI PIN. What should you do?", o: ["Enter the PIN to receive the money", "Enter the PIN only if the amount is small", "Ask the sender to provide another QR code", "Cancel and verify the transaction"], a: 3 },
  { q: "A student deletes an important file from their laptop and also empties the Recycle Bin. Which statement is most accurate?", o: ["The file is always permanently destroyed immediately", "The file may still be recoverable until its storage space is overwritten", "The file automatically moves to the cloud for backup", "The operating system permanently encrypts the deleted file"], a: 1 },
  { q: "An app for a simple calculator asks for access to your contacts, microphone and location. What is the main concern?", o: ["The app may use unnecessary permissions", "The calculator may stop working offline", "The app may increase screen brightness", "The phone may require more storage"], a: 0 },
  { q: "Which situation is the clearest example of social engineering?", o: ["A computer automatically installs a security update", "A firewall blocks an unauthorized connection", "A caller pretends to be IT staff and asks for an OTP", "Antivirus software detects a suspicious file"], a: 2 },
  { q: "A website has HTTPS and a padlock. Which conclusion is safest?", o: ["The website is guaranteed to be genuine", "The connection has encryption protection", "The website cannot contain harmful content", "The website has been approved by your college"], a: 1 },
  { q: "A student uses the same password for email, Instagram and banking. The Instagram account is hacked. Why is this more serious than losing only Instagram?", o: ["Instagram can automatically access every device", "The email provider controls the banking account", "Changing one password will delete all accounts", "The other accounts may be targeted with the same password"], a: 3 },
  { q: "You receive an OTP that you did not request. Which response is most appropriate?", o: ["Share it with customer support if they call", "Check the account and secure it if needed", "Ignore it because an OTP cannot be misused", "Forward it to a friend for verification"], a: 1 },
  { q: "Which statement is the most accurate about cyber security?", o: ["Cyber security depends only on antivirus software", "Cyber security is required only by IT professionals", "Security combines technology and safe user behavior", "Cyber attacks happen only to large organizations"], a: 2 }
];

async function getWindow() {
  let s = null;
  if (db.enabled) { try { s = await db.get('settings'); } catch (e) {} }
  const start = new Date(s ? s.start : DEF_START);
  const end = new Date(s ? s.end : DEF_START.getTime() + DEF_DAYS * 86400000);
  return { start, end };
}
function statusOf(w) {
  const n = new Date();
  return n < w.start ? 'not_started' : n > w.end ? 'closed' : 'open';
}
const TOTAL_Q = 15;
if (QUESTIONS.length !== TOTAL_Q) throw new Error('Quiz must have exactly ' + TOTAL_Q + ' questions');
const PASS_MARKS = Math.ceil(TOTAL_Q * PASS_PERCENT / 100); // 65% of 15 = 9.75 -> 10 correct answers
module.exports = { PASS_PERCENT, PASS_MARKS, MAX_ATTEMPTS, QUESTIONS, getWindow, statusOf };
