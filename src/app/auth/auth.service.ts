import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly TOKEN_KEY = 'auth_token';

  // Local fallback users until backend auth endpoint is wired.
  private readonly VALID_USERS = [
    { username: 'admin', password: 'admin123' },
    { username: 'uriwuwu', password: 'leire3838' }
  ];

  login(username: string, password: string): boolean {
    const user = this.VALID_USERS.find(item => item.username === username && item.password === password);
    if (user) {
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
