# Mon Congélateur + Open Food Facts

Après un scan, l'application cherche d'abord localement, puis appelle Open Food Facts pour préremplir le nom, la marque, le conditionnement et l'image. Si le produit ou le réseau est indisponible, la saisie manuelle reste possible.

```bash
npm install
npm run dev
npm run build
npm run android:add
npm run android:sync
npm run android:open
```

Après chaque modification : `npm run android:sync`.
