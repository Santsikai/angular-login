import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly TOKEN_KEY = 'auth_token';

  // Demo credentials — replace with real API call in production
  private readonly VALID_USER = { username: 'admin', password: 'admin123' };

  login(username: string, password: string): boolean {
    if (username === this.VALID_USER.username && password === this.VALID_USER.password) {
      localStorage.setItem(this.TOKEN_KEY, btoa(`${username}:${Date.now()}`));
      sessionStorage.removeItem(this.TOKEN_KEY);
      return true;
    }
    return false;
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const localToken = localStorage.getItem(this.TOKEN_KEY);
    if (localToken) {
      return true;
    }

    // Keep users signed in after deployments that switch storage strategy.
    const sessionToken = sessionStorage.getItem(this.TOKEN_KEY);
    if (!sessionToken) {
      return false;
    }

    localStorage.setItem(this.TOKEN_KEY, sessionToken);
    sessionStorage.removeItem(this.TOKEN_KEY);
    return true;
  }
}
