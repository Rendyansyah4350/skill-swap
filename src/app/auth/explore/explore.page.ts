import { Component, OnInit } from '@angular/core';
import { Firestore, collection, collectionData, query, where, limit } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Router } from '@angular/router'; // Tambahkan Router
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

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
  recommendedUsers$: Observable<UserProfile[]> = of([]);
  searchResult$: Observable<UserProfile[]> = of([]);
  searchTerm$ = new BehaviorSubject<string>('');
  recentUsers: UserProfile[] = [];
  currentUid: string | undefined;

  constructor(
    private firestore: Firestore, 
    private auth: Auth,
    private router: Router // Inject Router di sini
  ) {
    const userCollect = collection(this.firestore, 'users');

    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUid = user.uid;
        this.loadHistory();

        const qRecommended = query(
          userCollect, 
          where('uid', '!=', this.currentUid),
          limit(5)
        );
        this.recommendedUsers$ = collectionData(qRecommended) as Observable<UserProfile[]>;
      }
    });

    this.searchResult$ = this.searchTerm$.pipe(
      switchMap(term => {
        if (!term || term.trim().length < 2) return of([]);
        
        const qSearch = query(
          userCollect,
          where('uid', '!=', this.currentUid)
        );
        
        return collectionData(qSearch).pipe(
          map(users => {
            const searchText = term.toLowerCase().trim();
            const typedUsers = users as UserProfile[];
            
            return typedUsers.filter(u => 
              u.fullName?.toLowerCase().includes(searchText) || 
              u.skillsOffered?.some(s => s.toLowerCase().includes(searchText))
            ).slice(0, 10);
          })
        );
      })
    );
  }

  ngOnInit() {}

  onSearchChange(event: any) {
    this.searchTerm$.next(event.detail.value);
  }

  // Fungsi navigasi satu pintu
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

  // Fungsi baru untuk hapus histori
  clearHistory() {
    if (!this.currentUid) return;
    const storageKey = `recent_views_${this.currentUid}`;
    localStorage.removeItem(storageKey);
    this.recentUsers = [];
  }
}