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

## Synchroniser les donnees entre deux telephones (Firebase)

1. Creez un projet Firebase.
2. Activez Authentication > Sign-in method > Anonymous.
3. Activez Firestore Database (mode production recommande).
4. Copiez `.env.example` vers `.env` et renseignez les variables `VITE_FIREBASE_*`.
5. Lancez l'app sur les deux telephones avec la meme configuration Firebase.
6. Dans Reglages, saisissez le meme identifiant de foyer (ex: `famille-dupont`) sur les deux appareils.

L'application synchronise en temps reel les emplacements et produits dans `households/{identifiant}`.

### Exemple de regles Firestore (MVP)

```txt
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /households/{householdId} {
			allow read, write: if request.auth != null;
		}
	}
}
```

### Depannage: Firebase Error (auth/configuration-not-found)

Si cette erreur apparait, le projet Firebase n'a pas encore Authentication configuree.

1. Ouvrez Firebase Console > votre projet > Build > Authentication.
2. Cliquez sur "Get started" si propose.
3. Onglet "Sign-in method" > activez "Anonymous".
4. Verifiez que `VITE_FIREBASE_PROJECT_ID` et `VITE_FIREBASE_API_KEY` pointent bien vers ce meme projet.
5. Redemarrez `npm run dev` (Vite recharge .env au demarrage).
