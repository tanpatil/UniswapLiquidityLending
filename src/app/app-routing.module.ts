import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { ListingDetailsComponent } from './components/marketplace/listing-details/listing-details.component';
import { ListingsComponent } from './components/marketplace/listings/listings.component';
import { NewListingComponent } from './components/marketplace/new-listing/new-listing.component';
import { ProfileComponent } from './components/profile/profile.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'listings', component: ListingsComponent },
  { path: 'new', component: NewListingComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'listing/:id', component: ListingDetailsComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
