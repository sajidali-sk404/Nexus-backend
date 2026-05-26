import nodemailer from 'nodemailer';

// ✅ Create transporter
const createTransporter = () => {
  // Check if email config exists
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email not configured. Using mock mode.');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ✅ Send email function
export const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = createTransporter();

  // Mock mode - just log the email
  if (!transporter) {
    return { messageId: 'mock-' + Date.now() };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Business Nexus" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return info;
  } catch (error) {
    console.error('❌ Email send failed:', error);
    throw error;
  }
};

// ✅ Generate OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ✅ OTP Email Template
export const getOTPEmailTemplate = (name, otp) => {
  return {
    subject: 'Your Business Nexus Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; margin: 0;">Business Nexus</h1>
          <p style="color: #6B7280; margin-top: 5px;">Secure Verification</p>
        </div>
        
        <div style="background: #F9FAFB; border-radius: 12px; padding: 30px; text-align: center;">
          <h2 style="color: #111827; margin-bottom: 10px;">Hi ${name},</h2>
          <p style="color: #6B7280; margin-bottom: 20px;">
            Your verification code is:
          </p>
          
          <div style="background: #4F46E5; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 15px 30px; border-radius: 8px; display: inline-block;">
            ${otp}
          </div>
          
          <p style="color: #9CA3AF; margin-top: 20px; font-size: 14px;">
            This code expires in <strong>10 minutes</strong>.
          </p>
          <p style="color: #9CA3AF; font-size: 14px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #9CA3AF; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Business Nexus. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `Hi ${name}, Your Business Nexus verification code is: ${otp}. This code expires in 10 minutes.`,
  };
};

// ✅ Welcome Email Template
export const getWelcomeEmailTemplate = (name) => {
  return {
    subject: 'Welcome to Business Nexus! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5;">Welcome to Business Nexus!</h1>
        </div>
        <div style="background: #F9FAFB; border-radius: 12px; padding: 30px;">
          <h2 style="color: #111827;">Hi ${name},</h2>
          <p style="color: #4B5563;">
            Your account has been created successfully. Start connecting with investors
            and entrepreneurs today!
          </p>
          <div style="text-align: center; margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" 
               style="background: #4F46E5; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; display: inline-block;">
              Get Started
            </a>
          </div>
        </div>
      </div>
    `,
    text: `Hi ${name}, Welcome to Business Nexus! Your account has been created successfully.`,
  };
};

// ✅ Password Reset Email Template
export const getPasswordResetTemplate = (name, resetUrl) => {
  return {
    subject: 'Reset Your Password - Business Nexus',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5;">Password Reset</h1>
        </div>
        <div style="background: #F9FAFB; border-radius: 12px; padding: 30px;">
          <h2 style="color: #111827;">Hi ${name},</h2>
          <p style="color: #4B5563;">
            We received a request to reset your password. Click the button below:
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" 
               style="background: #4F46E5; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 14px;">
            This link expires in 1 hour. If you didn't request this, ignore this email.
          </p>
        </div>
      </div>
    `,
    text: `Hi ${name}, Reset your password here: ${resetUrl}. Link expires in 1 hour.`,
  };
};