import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard'; // Pastikan path import ini benar

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./auth/login/login.module').then( m => m.LoginPageModule)
  },
  {
    path: 'register',
    loadChildren: () => import('./auth/register/register.module').then( m => m.RegisterPageModule)
  },
  {
    path: 'tabs',
    loadChildren: () => import('./auth/tabs/tabs.module').then( m => m.TabsPageModule),
    canActivate: [AuthGuard] // SATPAM JAGA DI SINI (Menjaga semua tab di dalamnya)
  },
  {
    path: '',
    redirectTo: 'tabs', // Redirect ke tabs, nanti Guard yang cek mau ke login atau lanjut
    pathMatch: 'full'
  },
  {
    path: 'explore',
    loadChildren: () => import('./auth/explore/explore.module').then( m => m.ExplorePageModule)
  },
  {
    path: 'profile',
    loadChildren: () => import('./auth/profile/profile.module').then( m => m.ProfilePageModule)
  },
  {
    path: 'user-detail',
    loadChildren: () => import('./auth/user-detail/user-detail.module').then( m => m.UserDetailPageModule)
  },
  {
    path: 'chat-detail',
    loadChildren: () => import('./auth/chat-detail/chat-detail.module').then( m => m.ChatDetailPageModule)
  },
  {
    path: 'profile-view',
    loadChildren: () => import('./auth/profile-view/profile-view.module').then( m => m.ProfileViewPageModule)
  },
  {
    path: 'forgot-password',
    loadChildren: () => import('./auth/forgot-password/forgot-password.module').then( m => m.ForgotPasswordPageModule)
  },
  // Jalur 'home' dihapus dari sini karena sudah dipindah ke tabs-routing.module.ts
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }