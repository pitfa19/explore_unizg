# Analiza performansi - Glavni problemi

## 🔴 Najveći problemi (prioritet)

### 1. GraphCanvas (reagraph) - ⚠️ KRITIČNO
- **Problem**: Težak 3D graf komponenta koja se učitava odmah
- **Utjecaj**: ~500KB+ bundle, blokira render
- **Rješenje**: Lazy load + Suspense, defer render dok nije u viewportu

### 2. Svi komponenti se učitavaju odjednom
- **Problem**: Nema code splitting, sve se učitava na početku
- **Utjecaj**: Velik initial bundle, sporo First Contentful Paint
- **Rješenje**: Dynamic imports za teške komponente

### 3. Slike s Unsplash-a (vanjski resursi)
- **Problem**: 6+ slika se učitavaju s vanjskog servera
- **Utjecaj**: Spori LCP (Largest Contentful Paint), ovisnost o vanjskom serveru
- **Rješenje**: Next Image optimizacija, lazy loading, placeholder

### 4. Motion/react animacije
- **Problem**: Sve animacije se pokreću odjednom
- **Utjecaj**: Blokira render thread
- **Rješenje**: Intersection Observer, animate samo kada je u viewportu

### 5. MotivationSection - 6 slika odjednom
- **Problem**: Sve slike se učitavaju bez lazy loading
- **Utjecaj**: Veliki network zahtjev
- **Rješenje**: Lazy loading, next/image optimizacija

## 📊 Procjena utjecaja

| Problem | Utjecaj | Prioritet |
|---------|---------|-----------|
| GraphCanvas | 🔴 Vrlo visok | 1 |
| Code splitting | 🟠 Visok | 2 |
| Slike optimizacija | 🟠 Visok | 3 |
| Animacije optimizacija | 🟡 Srednji | 4 |
| Bundle size | 🟡 Srednji | 5 |

## ✅ Plan optimizacije

1. Dynamic import za NetworkGraph
2. Lazy loading za MotivationSection
3. Optimizacija slika (next/image)
4. Intersection Observer za animacije
5. Memoization komponenti
6. Reduce initial bundle size

