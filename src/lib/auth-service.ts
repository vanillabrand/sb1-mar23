import { supabase } from './supabase-client';
import { logService } from './log-service';

export class AuthService {
  private static instance: AuthService;
  private sessionTimeout: NodeJS.Timeout | null = null;

  async checkSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (!session) {
        this.handleSessionExpired();
        return false;
      }

      this.setupSessionTimeout(session.expires_at);
      return true;
    } catch (error) {
      logService.log('error', 'Session check failed', error, 'AuthService');
      return false;
    }
  }

  private setupSessionTimeout(expiresAt: number) {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }

    const timeUntilExpiry = expiresAt - Date.now();
    if (timeUntilExpiry > 0) {
      this.sessionTimeout = setTimeout(
        () => this.handleSessionExpired(),
        timeUntilExpiry
      );
    }
  }

  private handleSessionExpired() {
    window.location.href = '/login';
  }
}
