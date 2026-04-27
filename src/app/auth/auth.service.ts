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
      sessionStorage.setItem(this.TOKEN_KEY, btoa(`${username}:${Date.now()}`));
      return true;
    }
    return false;
  }

  logout(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem(this.TOKEN_KEY);
  }
}
