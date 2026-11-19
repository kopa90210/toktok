import { normalizeArabicDigits, validateEgyptianPhone } from '../domain/stateMachine';
import { IAuthProvider, OtpSendResult, OtpVerifyResult } from './interfaces';

class DemoPhoneAuthProvider implements IAuthProvider {
  readonly isDemoMode = true;
  private otpStore = new Map<string, string>();

  async sendOtp(phone: string): Promise<OtpSendResult> {
    await new Promise((r) => setTimeout(r, 450));
    const check = validateEgyptianPhone(phone);
    if (!check.valid) {
      return { ok: false, error: check.error, isDemoMode: true };
    }
    // Deterministic-friendly 4-digit test OTP for smooth demo testing
    const code = '4829';
    this.otpStore.set(check.normalized, code);
    return {
      ok: true,
      demoOtpCode: code,
      isDemoMode: true,
    };
  }

  async verifyOtp(phone: string, rawCode: string): Promise<OtpVerifyResult> {
    await new Promise((r) => setTimeout(r, 400));
    const check = validateEgyptianPhone(phone);
    if (!check.valid) {
      return { ok: false, error: 'رقم الهاتف غير صالح.' };
    }
    const expected = this.otpStore.get(check.normalized) ?? '4829';
    const normalizedInput = normalizeArabicDigits(rawCode).trim();
    if (normalizedInput.length !== 4) {
      return { ok: false, error: 'أدخل رمز التحقق المكون من 4 أرقام.' };
    }
    if (normalizedInput !== expected) {
      return {
        ok: false,
        error: `رمز التحقق غير صحيح. (رمز الاختبار التجريبي هو ${expected})`,
      };
    }
    return { ok: true };
  }

  getActiveDemoOtp(phone: string): string | null {
    const check = validateEgyptianPhone(phone);
    if (!check.valid) return null;
    return this.otpStore.get(check.normalized) ?? '4829';
  }
}

export const authProvider: IAuthProvider = new DemoPhoneAuthProvider();
