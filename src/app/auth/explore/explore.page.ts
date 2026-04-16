import { Component, OnInit } from '@angular/core';
import { Firestore, collection, collectionData, query, where, limit } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Router } from '@angular/router';   
import { Observable, BehaviorSubject, of, combineLatest } from 'rxjs';
import { map, switchMap, startWith } from 'rxjs/operators';

interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  skillsOffered: string[];
}

@Component({
  selector: 'app-explore',
  templateUrl: './explore.page.html',
  styleUrls: ['./explore.page.scss'],
  standalone: false,
})
export class ExplorePage implements OnInit {
  // Gunakan Observable untuk semua agar sinkron dengan blokir
  recommendedUsers$: Observable<UserProfile[]> = of([]);
  searchResult$: Observable<UserProfile[]> = of([]);
  searchTerm$ = new BehaviorSubject<string>('');
  
  recentUsers: UserProfile[] = [];
  currentUid: string = '';

  constructor(
    private firestore: Firestore, 
    private auth: Auth,
    private router: Router
  ) {
    // Jalankan auth listener
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUid = user.uid;
        this.loadHistory();
        this.initExploreLogic(); // Kita kumpulkan logic-nya di satu fungsi
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnInit() {}

  private initExploreLogic() {
    const userCollect = collection(this.firestore, 'users');
    const blockCol = collection(this.firestore, 'blocks');

    // 1. Ambil daftar UID yang saya blokir secara real-time
    const myBlocksQuery = query(blockCol, where('blockerUid', '==', this.currentUid));
    const blockedUids$ = collectionData(myBlocksQuery).pipe(
      map(blocks => blocks.map(b => b['blockedUid'] as string)),
      startWith([] as string[]) 
    );

    // 2. LOGIC REKOMENDASI (Difilter Blokir & Filter Akun Hantu)
    const allUsers$ = collectionData(userCollect, { idField: 'uid' }) as Observable<UserProfile[]>;
    
    this.recommendedUsers$ = combineLatest([allUsers$, blockedUids$]).pipe(
      map(([users, blockedUids]) => {
        return users
          .filter(u => 
            u.fullName && // <-- FILTER AKUN HANTU: Pastikan data nama ada
            u.uid !== this.currentUid && 
            !blockedUids.includes(u.uid)
          )
          .slice(0, 5); // Limit 5 rekomendasi
      })
    );

    // 3. LOGIC PENCARIAN (Difilter Blokir & Filter Akun Hantu)
    this.searchResult$ = this.searchTerm$.pipe(
      switchMap(term => {
        if (!term || term.trim().length < 2) return of([]);
        
        const searchText = term.toLowerCase().trim();
        
        return combineLatest([allUsers$, blockedUids$]).pipe(
          map(([users, blockedUids]) => {
            return users.filter(u => 
              u.fullName && // <-- FILTER AKUN HANTU: Pastikan data nama ada
              u.uid !== this.currentUid && 
              !blockedUids.includes(u.uid) &&
              (u.fullName?.toLowerCase().includes(searchText) || u.skillsOffered?.some(s => s.toLowerCase().includes(searchText)))
            ).slice(0, 10);
          })
        );
      })
    );
  }

  onSearchChange(event: any) {
    this.searchTerm$.next(event.detail.value);
  }

  goToDetail(user: UserProfile) {
    this.addToHistory(user);
    this.router.navigate(['/tabs/user-detail', user.uid]);
  }

  addToHistory(user: UserProfile) {
    if (!this.currentUid) return;
    const storageKey = `recent_views_${this.currentUid}`;
    let history: UserProfile[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    history = history.filter(u => u.uid !== user.uid);
    history.unshift(user);
    history = history.slice(0, 3); 
    
    localStorage.setItem(storageKey, JSON.stringify(history));
    this.loadHistory();
  }

  loadHistory() {
    if (!this.currentUid) return;
    const storageKey = `recent_views_${this.currentUid}`;
    this.recentUsers = JSON.parse(localStorage.getItem(storageKey) || '[]');
  }

  clearHistory() {
    if (!this.currentUid) return;
    const storageKey = `recent_views_${this.currentUid}`;
    localStorage.removeItem(storageKey);
    this.recentUsers = [];
  }
}