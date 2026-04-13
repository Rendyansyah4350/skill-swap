import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  // Gunakan inject() untuk menjaga konteks
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);

  // Simpan observable di level property
  private authState$ = authState(this.auth);

  canActivate(): Observable<boolean | UrlTree> {
    return this.authState$.pipe(
      take(1),
      map(user => {
        if (user) {
          return true;
        } else {
          return this.router.parseUrl('/login');
        }
      })
    );
  }
}