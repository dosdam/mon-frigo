# Mon Congélateur

Application React + Tailwind empaquetée avec Capacitor pour Android. Scan EAN/UPC/Code 128/QR avec html5-qrcode, multi-congélateurs, étages, quantités, dates de péremption et stockage local.

## Prérequis
- Node.js et npm
- Android Studio avec SDK Android
- Un téléphone Android avec débogage USB, ou un émulateur

## Installation
```bash
npm install
npm run dev
```

## Créer le projet Android
À exécuter une seule fois :
```bash
npm run build
npm run android:add
npm run android:sync
npm run android:open
```

Si le dossier `android` existe déjà :
```bash
npm run android:sync
npm run android:open
```

Dans Android Studio, sélectionner le téléphone puis cliquer sur Run. Pour produire un APK : menu Build > Build App Bundles or APKs > Build APKs.

## Permission caméra
Capacitor fusionne normalement la permission caméra demandée par la WebView. Si nécessaire, vérifier la présence de cette ligne dans `android/app/src/main/AndroidManifest.xml` :
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

## Après une modification React
```bash
npm run android:sync
```
