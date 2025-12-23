# Dealer Dashboard Design Proposal

## Overview
Transform the dealer portal into a comprehensive dashboard that provides at-a-glance insights, quick actions, and easy navigation to key features.

## Dashboard Layout

### Top Section: Welcome & Account Info
- **Welcome message** with dealer name
- **Account tier badge** (Tier A/B/C)
- **Quick stats cards**:
  - Total orders
  - Pending orders
  - Total spent (optional)
  - Available credit (if applicable)

### Main Content: Three-Column Layout

#### Left Column: Quick Actions & Navigation
- **Quick Actions Card**:
  - Browse guitars (primary CTA)
  - View all orders
  - Submit new order
  - Download catalog (if available)
- **Account Information**:
  - Account name
  - Tier level
  - Currency
  - Territory
  - Contact info

#### Center Column: Recent Activity
- **Recent Orders** (last 5-10):
  - Order number
  - Date
  - Status badge
  - Total amount
  - Quick view link
- **Order Status Summary**:
  - Submitted (count)
  - Approved (count)
  - In Production (count)
  - Shipped (count)

#### Right Column: Featured/New Products
- **Featured Guitars** (3-4 cards):
  - New arrivals
  - Best sellers
  - Limited stock items
- **Quick browse** link to full catalog

### Bottom Section: Product Grid Preview
- **Available to Order** section
- Grid of 6-8 featured guitars
- "View all" link to full catalog

## Design Principles

1. **Information Hierarchy**: Most important info at top
2. **Quick Access**: Common actions easily accessible
3. **Visual Balance**: Cards and sections well-spaced
4. **Responsive**: Stacks nicely on mobile
5. **Professional**: Clean, B2B-appropriate aesthetic

## Components Needed

1. **StatsCard**: Reusable stat display component
2. **RecentOrdersList**: Compact order list with status
3. **QuickActionsCard**: Button group for common actions
4. **AccountInfoCard**: Account details display
5. **FeaturedProducts**: Horizontal scroll or grid of featured items

## Data Requirements

- Order history (last 10 orders)
- Order status counts
- Account information
- Featured/new products from catalog

## User Flow

1. **Landing**: User sees dashboard overview
2. **Quick Actions**: One-click access to common tasks
3. **Recent Orders**: Quick access to order details
4. **Browse**: Easy navigation to full product catalog
5. **Account**: View and manage account settings (future)


