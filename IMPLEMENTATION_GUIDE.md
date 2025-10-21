# Implementation Guide: High-Quality Seat Summaries

This guide provides concrete implementation examples for the approaches outlined in SUMMARY_QUALITY_IMPROVEMENTS.md.

---

## Architecture Overview

```
src/
├── data/
│   ├── sources/
│   │   ├── officialDataSource.ts
│   │   ├── userReviewSource.ts
│   │   └── pricingSource.ts
│   ├── validators/
│   │   ├── dataValidator.ts
│   │   └── qualityScorer.ts
│   └── aggregator.ts
├── models/
│   ├── SeatSection.ts
│   ├── Summary.ts
│   └── UserPreferences.ts
├── services/
│   ├── summaryGenerator.ts
│   ├── personalizationEngine.ts
│   └── cacheManager.ts
└── presentation/
    ├── components/
    │   ├── SummaryCard.tsx
    │   ├── DetailedView.tsx
    │   └── ComparisonView.tsx
    └── formatters/
        └── summaryFormatter.ts
```

---

## 1. Data Models

### SeatSection Model
```typescript
// src/models/SeatSection.ts

export interface Location {
  section: string;
  row?: string;
  seats?: string[];
  level: 'courtside' | 'lower-bowl' | 'mid-level' | 'upper-level';
}

export interface PricingInfo {
  current: number;
  min: number;
  max: number;
  average: number;
  currency: string;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  lastUpdated: Date;
}

export interface ViewMetrics {
  quality: number; // 0-10
  distanceToCourtFeet: number;
  elevationAngle: number; // degrees
  hasObstructions: boolean;
  obstructionDetails?: string[];
  centerCourtView: boolean;
}

export interface Amenities {
  inSeatService: boolean;
  vipEntrance: boolean;
  cushionedSeats: boolean;
  cupHolders: boolean;
  powerOutlets: boolean;
  wifiQuality: 'excellent' | 'good' | 'fair' | 'poor';
  nearbyFacilities: {
    restrooms: number; // distance in feet
    concessions: number;
    giftShop: number;
  };
}

export interface AccessibilityInfo {
  wheelchairAccessible: boolean;
  companionSeatsAvailable: boolean;
  elevatorAccess: boolean;
  assistiveListeningDevices: boolean;
  transferSeats: boolean;
  accessRoute: string;
}

export interface UserFeedback {
  averageRating: number;
  totalReviews: number;
  verifiedReviews: number;
  sentimentScore: number; // -1 to 1
  commonPros: string[];
  commonCons: string[];
  recentReviews: Review[];
}

export interface Review {
  id: string;
  rating: number;
  text: string;
  verified: boolean;
  date: Date;
  helpful: number;
  gameAttended?: string;
}

export interface DataQuality {
  completeness: number; // 0-1
  accuracy: number; // 0-1
  freshness: number; // 0-1, based on age
  confidence: number; // 0-1, overall confidence
  sources: string[];
  lastValidated: Date;
}

export interface SeatSection {
  location: Location;
  pricing: PricingInfo;
  view: ViewMetrics;
  amenities: Amenities;
  accessibility: AccessibilityInfo;
  userFeedback: UserFeedback;
  dataQuality: DataQuality;
  photos: string[]; // URLs
  video360Url?: string;
  popularityRank: number;
  recommendationScore?: number; // Personalized, set at runtime
}
```

### User Preferences Model
```typescript
// src/models/UserPreferences.ts

export interface UserPreferences {
  userId?: string;
  priorities: {
    viewQuality: number; // 0-10 importance
    price: number;
    atmosphere: number;
    accessibility: number;
    amenities: number;
  };
  constraints: {
    maxBudget?: number;
    minViewQuality?: number;
    requiresAccessibility: boolean;
    requiresInSeatService: boolean;
  };
  useCase: 'family' | 'date' | 'hardcore-fan' | 'corporate' | 'casual';
  previousPurchases?: string[]; // section IDs
  savedSections?: string[];
}

export function calculateMatchScore(
  section: SeatSection,
  prefs: UserPreferences
): number {
  let score = 0;
  const weights = prefs.priorities;

  // View quality match
  score += (section.view.quality / 10) * weights.viewQuality;

  // Price match (inverse - lower is better)
  const priceScore = prefs.constraints.maxBudget
    ? Math.max(0, 1 - (section.pricing.current / prefs.constraints.maxBudget))
    : 0.5;
  score += priceScore * weights.price;

  // Atmosphere (based on location and user feedback)
  const atmosphereScore = section.location.level === 'courtside' ? 1.0 :
                         section.location.level === 'lower-bowl' ? 0.8 :
                         section.location.level === 'mid-level' ? 0.6 : 0.4;
  score += atmosphereScore * weights.atmosphere;

  // Accessibility match
  const accessScore = section.accessibility.wheelchairAccessible ? 1 : 0;
  score += accessScore * weights.accessibility;

  // Amenities match
  const amenityScore = (
    (section.amenities.inSeatService ? 0.3 : 0) +
    (section.amenities.vipEntrance ? 0.2 : 0) +
    (section.amenities.cushionedSeats ? 0.2 : 0) +
    (section.amenities.wifiQuality === 'excellent' ? 0.3 : 0)
  );
  score += amenityScore * weights.amenities;

  // Normalize
  const maxScore = Object.values(weights).reduce((a, b) => a + b, 0);
  return (score / maxScore) * 10;
}
```

---

## 2. Data Aggregation & Validation

### Multi-Source Aggregator
```typescript
// src/data/aggregator.ts

import { SeatSection, DataQuality } from '../models/SeatSection';

interface DataSource {
  name: string;
  priority: number; // Higher = more trusted
  fetch: (sectionId: string) => Promise<Partial<SeatSection>>;
}

export class DataAggregator {
  private sources: DataSource[];

  constructor(sources: DataSource[]) {
    this.sources = sources.sort((a, b) => b.priority - a.priority);
  }

  async aggregateSectionData(sectionId: string): Promise<SeatSection> {
    const dataPoints: Partial<SeatSection>[] = [];
    const sourceNames: string[] = [];

    // Fetch from all sources in parallel
    const results = await Promise.allSettled(
      this.sources.map(source => source.fetch(sectionId))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        dataPoints.push(result.value);
        sourceNames.push(this.sources[index].name);
      }
    });

    // Merge data with conflict resolution
    const merged = this.mergeWithConflictResolution(dataPoints);

    // Calculate data quality metrics
    const quality = this.assessDataQuality(dataPoints, sourceNames);

    return {
      ...merged,
      dataQuality: quality
    } as SeatSection;
  }

  private mergeWithConflictResolution(
    dataPoints: Partial<SeatSection>[]
  ): Partial<SeatSection> {
    const merged: any = {};

    // For each field, use the value from highest priority source
    dataPoints.forEach(data => {
      Object.keys(data).forEach(key => {
        if (merged[key] === undefined) {
          merged[key] = (data as any)[key];
        }
      });
    });

    // Special handling for numeric values - take average when available
    if (dataPoints.length > 1) {
      const prices = dataPoints
        .map(d => d.pricing?.current)
        .filter(p => p !== undefined) as number[];

      if (prices.length > 1) {
        merged.pricing = merged.pricing || {};
        merged.pricing.average = prices.reduce((a, b) => a + b) / prices.length;
        merged.pricing.min = Math.min(...prices);
        merged.pricing.max = Math.max(...prices);
      }
    }

    return merged;
  }

  private assessDataQuality(
    dataPoints: Partial<SeatSection>[],
    sources: string[]
  ): DataQuality {
    // Count populated fields
    const allFields = new Set<string>();
    const populatedFields = new Set<string>();

    dataPoints.forEach(data => {
      this.getNestedKeys(data).forEach(key => {
        allFields.add(key);
        if (this.hasValue(data, key)) {
          populatedFields.add(key);
        }
      });
    });

    const completeness = populatedFields.size / Math.max(allFields.size, 1);

    // Accuracy based on source agreement
    const accuracy = this.calculateAgreement(dataPoints);

    // Freshness (assume newer data from fetch time)
    const freshness = 1.0; // Just fetched

    const confidence = (completeness + accuracy + freshness) / 3;

    return {
      completeness,
      accuracy,
      freshness,
      confidence,
      sources,
      lastValidated: new Date()
    };
  }

  private calculateAgreement(dataPoints: Partial<SeatSection>[]): number {
    if (dataPoints.length < 2) return 1.0;

    let agreements = 0;
    let comparisons = 0;

    // Compare pricing data
    const prices = dataPoints
      .map(d => d.pricing?.current)
      .filter(p => p !== undefined) as number[];

    if (prices.length > 1) {
      const avgPrice = prices.reduce((a, b) => a + b) / prices.length;
      const variance = prices.reduce((sum, p) =>
        sum + Math.abs(p - avgPrice), 0) / prices.length;
      const agreement = 1 - Math.min(variance / avgPrice, 1);
      agreements += agreement;
      comparisons += 1;
    }

    return comparisons > 0 ? agreements / comparisons : 1.0;
  }

  private getNestedKeys(obj: any, prefix = ''): string[] {
    const keys: string[] = [];
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys.push(...this.getNestedKeys(obj[key], fullKey));
      }
    });
    return keys;
  }

  private hasValue(obj: any, path: string): boolean {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current[part] === undefined || current[part] === null) {
        return false;
      }
      current = current[part];
    }
    return true;
  }
}
```

---

## 3. AI-Powered Summary Generation

### Natural Language Summary Generator
```typescript
// src/services/summaryGenerator.ts

import { SeatSection, UserPreferences } from '../models';

export interface SummaryOptions {
  style: 'concise' | 'detailed' | 'comparison';
  personalize?: UserPreferences;
  includePhotos?: boolean;
  maxLength?: number;
}

export class SummaryGenerator {
  generateTextSummary(
    section: SeatSection,
    options: SummaryOptions = { style: 'concise' }
  ): string {
    const { style, personalize } = options;

    switch (style) {
      case 'concise':
        return this.generateConciseSummary(section, personalize);
      case 'detailed':
        return this.generateDetailedSummary(section, personalize);
      case 'comparison':
        return this.generateComparisonSummary(section);
      default:
        return this.generateConciseSummary(section, personalize);
    }
  }

  private generateConciseSummary(
    section: SeatSection,
    prefs?: UserPreferences
  ): string {
    const parts: string[] = [];

    // Title
    const levelName = this.formatLevel(section.location.level);
    parts.push(`**Section ${section.location.section}** - ${levelName}`);

    // Price and rating
    const price = `$${section.pricing.current}`;
    const rating = this.formatRating(section.userFeedback.averageRating);
    parts.push(`${rating} ${price}`);

    // Key highlight based on strengths
    const highlight = this.getKeyHighlight(section, prefs);
    if (highlight) {
      parts.push(highlight);
    }

    return parts.join(' | ');
  }

  private generateDetailedSummary(
    section: SeatSection,
    prefs?: UserPreferences
  ): string {
    const lines: string[] = [];

    // Header
    lines.push(`# Section ${section.location.section} - ${this.formatLevel(section.location.level)}\n`);

    // Rating and price
    lines.push(`${this.formatRating(section.userFeedback.averageRating)} ` +
               `(${section.userFeedback.totalReviews} reviews) | ` +
               `$${section.pricing.current}/seat\n`);

    // View quality
    lines.push(`## View Quality`);
    lines.push(`- Distance to court: ${section.view.distanceToCourtFeet} feet`);
    lines.push(`- View rating: ${section.view.quality}/10`);
    lines.push(`- Center court view: ${section.view.centerCourtView ? 'Yes' : 'No'}`);
    if (section.view.hasObstructions) {
      lines.push(`- ⚠️ Obstructions: ${section.view.obstructionDetails?.join(', ')}`);
    }
    lines.push('');

    // Amenities
    const amenityList = this.formatAmenities(section.amenities);
    if (amenityList.length > 0) {
      lines.push(`## Amenities`);
      amenityList.forEach(a => lines.push(`- ${a}`));
      lines.push('');
    }

    // User feedback
    if (section.userFeedback.commonPros.length > 0) {
      lines.push(`## What fans love:`);
      section.userFeedback.commonPros.slice(0, 3).forEach(pro => {
        lines.push(`- ${pro}`);
      });
      lines.push('');
    }

    if (section.userFeedback.commonCons.length > 0) {
      lines.push(`## Considerations:`);
      section.userFeedback.commonCons.slice(0, 3).forEach(con => {
        lines.push(`- ${con}`);
      });
      lines.push('');
    }

    // Personalized recommendation
    if (prefs) {
      const matchScore = this.calculatePersonalizedScore(section, prefs);
      lines.push(`## Your Match: ${matchScore}/10`);
      lines.push(this.explainMatch(section, prefs));
    }

    return lines.join('\n');
  }

  private generateComparisonSummary(section: SeatSection): string {
    // For comparison view - highlight differentiators
    return [
      `Section ${section.location.section}`,
      `View: ${section.view.quality}/10`,
      `Price: $${section.pricing.current}`,
      `Value: ${this.calculateValueScore(section)}/10`,
      `Popularity: #${section.popularityRank}`
    ].join(' | ');
  }

  private getKeyHighlight(
    section: SeatSection,
    prefs?: UserPreferences
  ): string {
    // Determine what to highlight based on section strengths and user prefs
    const highlights: Array<{score: number, text: string}> = [];

    if (section.view.quality >= 9) {
      highlights.push({ score: 10, text: '🎯 Exceptional view' });
    }

    const valueScore = this.calculateValueScore(section);
    if (valueScore >= 8) {
      highlights.push({ score: 9, text: '💎 Great value' });
    }

    if (section.popularityRank <= 10) {
      highlights.push({ score: 8, text: '🔥 Fan favorite' });
    }

    if (section.amenities.inSeatService) {
      highlights.push({ score: 7, text: '🍽️ Premium service' });
    }

    if (section.accessibility.wheelchairAccessible) {
      highlights.push({ score: 6, text: '♿ Accessible' });
    }

    // Sort by score and return top highlight
    highlights.sort((a, b) => b.score - a.score);
    return highlights[0]?.text || '';
  }

  private calculateValueScore(section: SeatSection): number {
    // Value = (view quality + amenities) / price
    const amenityScore = Object.values(section.amenities)
      .filter(v => typeof v === 'boolean')
      .filter(v => v === true)
      .length;

    const qualityScore = section.view.quality + (amenityScore * 0.5);
    const priceNormalized = Math.min(section.pricing.current / 500, 1);

    return Math.min((qualityScore / priceNormalized) * 2, 10);
  }

  private calculatePersonalizedScore(
    section: SeatSection,
    prefs: UserPreferences
  ): number {
    // Use the UserPreferences model's calculation
    return calculateMatchScore(section, prefs);
  }

  private explainMatch(section: SeatSection, prefs: UserPreferences): string {
    const explanations: string[] = [];

    // Check view quality match
    if (prefs.priorities.viewQuality > 7 && section.view.quality >= 8) {
      explanations.push('Excellent view quality matches your priority');
    }

    // Check price match
    if (prefs.constraints.maxBudget &&
        section.pricing.current <= prefs.constraints.maxBudget) {
      explanations.push('Within your budget');
    }

    // Check accessibility
    if (prefs.constraints.requiresAccessibility &&
        section.accessibility.wheelchairAccessible) {
      explanations.push('Meets accessibility requirements');
    }

    return explanations.join('. ') || 'Good general match for your preferences';
  }

  private formatLevel(level: string): string {
    const mapping: Record<string, string> = {
      'courtside': 'Courtside',
      'lower-bowl': 'Lower Bowl',
      'mid-level': 'Mid-Level',
      'upper-level': 'Upper Level'
    };
    return mapping[level] || level;
  }

  private formatRating(rating: number): string {
    const stars = '★'.repeat(Math.round(rating));
    const empty = '☆'.repeat(5 - Math.round(rating));
    return `${stars}${empty} ${rating.toFixed(1)}`;
  }

  private formatAmenities(amenities: any): string[] {
    const list: string[] = [];

    if (amenities.inSeatService) list.push('In-seat food & beverage service');
    if (amenities.vipEntrance) list.push('VIP entrance access');
    if (amenities.cushionedSeats) list.push('Premium cushioned seats');
    if (amenities.powerOutlets) list.push('Power outlets available');
    if (amenities.wifiQuality === 'excellent') list.push('Excellent WiFi');

    return list;
  }
}
```

---

## 4. Caching Strategy

```typescript
// src/services/cacheManager.ts

interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // milliseconds
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();

  // Cache configuration by data type
  private readonly TTL_CONFIG = {
    STATIC: 24 * 60 * 60 * 1000,      // 24 hours
    DYNAMIC_PRICE: 5 * 60 * 1000,      // 5 minutes
    USER_REVIEWS: 60 * 60 * 1000,      // 1 hour
    REAL_TIME: 0                        // No cache
  };

  set<T>(
    key: string,
    data: T,
    type: keyof typeof this.TTL_CONFIG
  ): void {
    const ttl = this.TTL_CONFIG[type];

    this.cache.set(key, {
      data,
      timestamp: new Date(),
      ttl
    });

    // Schedule cleanup
    if (ttl > 0) {
      setTimeout(() => this.cache.delete(key), ttl);
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    const age = Date.now() - entry.timestamp.getTime();
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    const regex = new RegExp(pattern);

    keys.forEach(key => {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Usage example
const cache = new CacheManager();

// Cache static seating layout
cache.set('section-117-layout', layoutData, 'STATIC');

// Cache dynamic pricing
cache.set('section-117-price', pricingData, 'DYNAMIC_PRICE');

// Retrieve
const layout = cache.get('section-117-layout');
```

---

## 5. React Component Example

```tsx
// src/presentation/components/SummaryCard.tsx

import React, { useState } from 'react';
import { SeatSection } from '../../models/SeatSection';
import { SummaryGenerator } from '../../services/summaryGenerator';

interface SummaryCardProps {
  section: SeatSection;
  onSelect?: (section: SeatSection) => void;
  compact?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  section,
  onSelect,
  compact = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const generator = new SummaryGenerator();

  const summary = generator.generateTextSummary(section, {
    style: compact ? 'concise' : 'detailed'
  });

  const valueScore = calculateValueScore(section);
  const getValueBadge = () => {
    if (valueScore >= 8) return { text: 'Great Value', color: 'green' };
    if (valueScore >= 6) return { text: 'Good Value', color: 'blue' };
    return { text: 'Premium', color: 'purple' };
  };

  const badge = getValueBadge();

  return (
    <div className="summary-card" onClick={() => setExpanded(!expanded)}>
      {/* Header */}
      <div className="summary-header">
        <h3>Section {section.location.section}</h3>
        <span className={`badge badge-${badge.color}`}>{badge.text}</span>
      </div>

      {/* Price and Rating */}
      <div className="summary-metrics">
        <span className="price">${section.pricing.current}</span>
        <span className="rating">
          {'★'.repeat(Math.round(section.userFeedback.averageRating))}
          {' '}
          {section.userFeedback.averageRating.toFixed(1)}
        </span>
        {section.pricing.trend !== 'stable' && (
          <span className={`trend trend-${section.pricing.trend}`}>
            {section.pricing.trend === 'up' ? '↑' : '↓'}
            {section.pricing.trendPercent}%
          </span>
        )}
      </div>

      {/* Quick Stats */}
      <div className="summary-stats">
        <div className="stat">
          <label>View</label>
          <span>{section.view.quality}/10</span>
        </div>
        <div className="stat">
          <label>Distance</label>
          <span>{section.view.distanceToCourtFeet}ft</span>
        </div>
        <div className="stat">
          <label>Popularity</label>
          <span>#{section.popularityRank}</span>
        </div>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="summary-details">
          <div className="amenities">
            {section.amenities.inSeatService && <span>🍽️ In-seat service</span>}
            {section.amenities.vipEntrance && <span>🎫 VIP entrance</span>}
            {section.amenities.cushionedSeats && <span>💺 Cushioned seats</span>}
          </div>

          {section.userFeedback.commonPros.length > 0 && (
            <div className="pros">
              <h4>What fans love:</h4>
              <ul>
                {section.userFeedback.commonPros.slice(0, 3).map((pro, i) => (
                  <li key={i}>{pro}</li>
                ))}
              </ul>
            </div>
          )}

          {section.photos.length > 0 && (
            <div className="photos">
              <img src={section.photos[0]} alt={`View from section ${section.location.section}`} />
              {section.photos.length > 1 && (
                <span className="photo-count">+{section.photos.length - 1} more</span>
              )}
            </div>
          )}

          <button onClick={() => onSelect?.(section)}>
            Select This Section
          </button>
        </div>
      )}

      {/* Data Quality Indicator */}
      {section.dataQuality.confidence < 0.7 && (
        <div className="quality-warning">
          ⚠️ Limited data available
        </div>
      )}
    </div>
  );
};

function calculateValueScore(section: SeatSection): number {
  const amenityScore = Object.values(section.amenities)
    .filter(v => typeof v === 'boolean' && v === true)
    .length;

  const qualityScore = section.view.quality + (amenityScore * 0.5);
  const priceNormalized = Math.min(section.pricing.current / 500, 1);

  return Math.min((qualityScore / priceNormalized) * 2, 10);
}
```

---

## 6. API Integration Example

```typescript
// src/data/sources/officialDataSource.ts

import { SeatSection } from '../../models/SeatSection';

export class OfficialMSGDataSource {
  private apiKey: string;
  private baseUrl = 'https://api.msg.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchSectionData(sectionId: string): Promise<Partial<SeatSection>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/venues/msg/sections/${sectionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return this.transformToSeatSection(data);

    } catch (error) {
      console.error('Failed to fetch official data:', error);
      return {};
    }
  }

  private transformToSeatSection(apiData: any): Partial<SeatSection> {
    return {
      location: {
        section: apiData.section_number,
        level: this.mapLevel(apiData.level),
      },
      view: {
        quality: apiData.view_rating,
        distanceToCourtFeet: apiData.distance_to_court,
        elevationAngle: apiData.elevation_angle,
        hasObstructions: apiData.has_obstructions,
        obstructionDetails: apiData.obstructions,
        centerCourtView: apiData.center_court_view
      },
      amenities: {
        inSeatService: apiData.amenities?.in_seat_service || false,
        vipEntrance: apiData.amenities?.vip_entrance || false,
        cushionedSeats: apiData.amenities?.cushioned_seats || false,
        cupHolders: apiData.amenities?.cup_holders || false,
        powerOutlets: apiData.amenities?.power_outlets || false,
        wifiQuality: apiData.wifi_quality || 'fair',
        nearbyFacilities: apiData.nearby_facilities
      },
      accessibility: {
        wheelchairAccessible: apiData.accessibility?.wheelchair || false,
        companionSeatsAvailable: apiData.accessibility?.companion_seats || false,
        elevatorAccess: apiData.accessibility?.elevator || false,
        assistiveListeningDevices: apiData.accessibility?.assistive_listening || false,
        transferSeats: apiData.accessibility?.transfer_seats || false,
        accessRoute: apiData.accessibility?.route || ''
      },
      photos: apiData.photos || []
    };
  }

  private mapLevel(apiLevel: string): SeatSection['location']['level'] {
    const mapping: Record<string, SeatSection['location']['level']> = {
      '1': 'courtside',
      '2': 'lower-bowl',
      '3': 'mid-level',
      '4': 'upper-level'
    };
    return mapping[apiLevel] || 'mid-level';
  }
}
```

---

## 7. Testing Strategy

```typescript
// src/__tests__/summaryGenerator.test.ts

import { SummaryGenerator } from '../services/summaryGenerator';
import { SeatSection } from '../models/SeatSection';

describe('SummaryGenerator', () => {
  let generator: SummaryGenerator;
  let mockSection: SeatSection;

  beforeEach(() => {
    generator = new SummaryGenerator();
    mockSection = createMockSection();
  });

  test('generates concise summary with key information', () => {
    const summary = generator.generateTextSummary(mockSection, {
      style: 'concise'
    });

    expect(summary).toContain('Section 117');
    expect(summary).toContain('$450');
    expect(summary).toContain('★');
  });

  test('includes personalized match score when preferences provided', () => {
    const prefs = {
      priorities: { viewQuality: 10, price: 5, atmosphere: 8, accessibility: 3, amenities: 7 },
      constraints: { maxBudget: 500, requiresAccessibility: false },
      useCase: 'hardcore-fan' as const
    };

    const summary = generator.generateTextSummary(mockSection, {
      style: 'detailed',
      personalize: prefs
    });

    expect(summary).toContain('Your Match:');
  });

  test('highlights accessibility when required', () => {
    const accessibleSection = {
      ...mockSection,
      accessibility: {
        ...mockSection.accessibility,
        wheelchairAccessible: true
      }
    };

    const prefs = {
      priorities: { viewQuality: 5, price: 5, atmosphere: 5, accessibility: 10, amenities: 5 },
      constraints: { requiresAccessibility: true },
      useCase: 'family' as const
    };

    const summary = generator.generateTextSummary(accessibleSection, {
      style: 'detailed',
      personalize: prefs
    });

    expect(summary).toContain('accessible');
  });
});

function createMockSection(): SeatSection {
  return {
    location: {
      section: '117',
      level: 'courtside'
    },
    pricing: {
      current: 450,
      min: 400,
      max: 850,
      average: 580,
      currency: 'USD',
      trend: 'stable',
      trendPercent: 0,
      lastUpdated: new Date()
    },
    view: {
      quality: 9.5,
      distanceToCourtFeet: 15,
      elevationAngle: 5,
      hasObstructions: false,
      centerCourtView: true
    },
    amenities: {
      inSeatService: true,
      vipEntrance: true,
      cushionedSeats: true,
      cupHolders: true,
      powerOutlets: false,
      wifiQuality: 'excellent',
      nearbyFacilities: {
        restrooms: 50,
        concessions: 30,
        giftShop: 100
      }
    },
    accessibility: {
      wheelchairAccessible: false,
      companionSeatsAvailable: false,
      elevatorAccess: true,
      assistiveListeningDevices: true,
      transferSeats: false,
      accessRoute: 'Main entrance'
    },
    userFeedback: {
      averageRating: 4.7,
      totalReviews: 847,
      verifiedReviews: 623,
      sentimentScore: 0.85,
      commonPros: ['Amazing view', 'Worth the price', 'Close to action'],
      commonCons: ['Expensive', 'Can be crowded'],
      recentReviews: []
    },
    dataQuality: {
      completeness: 0.95,
      accuracy: 0.92,
      freshness: 1.0,
      confidence: 0.95,
      sources: ['official', 'verified-reviews'],
      lastValidated: new Date()
    },
    photos: ['url1', 'url2'],
    popularityRank: 3
  };
}
```

---

## 8. Performance Optimization

### Progressive Loading
```typescript
// src/services/progressiveLoader.ts

export class ProgressiveSectionLoader {
  async loadSection(
    sectionId: string,
    onProgress?: (stage: string, data: Partial<SeatSection>) => void
  ): Promise<SeatSection> {

    // Stage 1: Load essential data (fast)
    const essential = await this.loadEssentialData(sectionId);
    onProgress?.('essential', essential);

    // Stage 2: Load enhanced data (medium)
    const enhanced = await this.loadEnhancedData(sectionId);
    onProgress?.('enhanced', { ...essential, ...enhanced });

    // Stage 3: Load full data (slower)
    const full = await this.loadFullData(sectionId);
    const complete = { ...essential, ...enhanced, ...full };
    onProgress?.('complete', complete);

    return complete as SeatSection;
  }

  private async loadEssentialData(sectionId: string): Promise<Partial<SeatSection>> {
    // Only location, basic pricing, and view quality
    return {
      location: await this.fetchLocation(sectionId),
      pricing: await this.fetchCurrentPrice(sectionId),
      view: await this.fetchViewQuality(sectionId)
    };
  }

  private async loadEnhancedData(sectionId: string): Promise<Partial<SeatSection>> {
    // Amenities and basic user feedback
    return {
      amenities: await this.fetchAmenities(sectionId),
      userFeedback: await this.fetchBasicFeedback(sectionId)
    };
  }

  private async loadFullData(sectionId: string): Promise<Partial<SeatSection>> {
    // Everything else: photos, detailed reviews, etc.
    return {
      photos: await this.fetchPhotos(sectionId),
      accessibility: await this.fetchAccessibility(sectionId),
      dataQuality: await this.assessQuality(sectionId)
    };
  }

  // Placeholder methods - implement with actual API calls
  private async fetchLocation(id: string): Promise<any> { return {}; }
  private async fetchCurrentPrice(id: string): Promise<any> { return {}; }
  private async fetchViewQuality(id: string): Promise<any> { return {}; }
  private async fetchAmenities(id: string): Promise<any> { return {}; }
  private async fetchBasicFeedback(id: string): Promise<any> { return {}; }
  private async fetchPhotos(id: string): Promise<string[]> { return []; }
  private async fetchAccessibility(id: string): Promise<any> { return {}; }
  private async assessQuality(id: string): Promise<any> { return {}; }
}
```

---

## Next Steps

1. **Set up data sources** - Implement connectors to MSG API, ticket marketplaces, review platforms
2. **Build aggregation pipeline** - Deploy the DataAggregator with real sources
3. **Create UI components** - Implement React components with progressive disclosure
4. **Implement caching** - Deploy CacheManager with appropriate TTLs
5. **Add personalization** - Build user preference collection and matching
6. **Deploy analytics** - Track summary effectiveness and iterate

This implementation provides a solid foundation for high-quality, personalized seat summaries that help users make informed decisions.
