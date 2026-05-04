import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

const API_BASE = globalThis.location?.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : '/api';

interface LoginResponse {
  userId: number;
  username: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_ID_KEY = 'auth_user_id';

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_BASE}/auth/login`, { username, password }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, btoa(`${username}:${Date.now()}`));
        localStorage.setItem(this.USER_ID_KEY, String(res.userId));
        sessionStorage.removeItem(this.TOKEN_KEY);
      })
    );
  }

  getUserId(): number {
    return Number(localStorage.getItem(this.USER_ID_KEY) || '1');
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_ID_KEY);
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
