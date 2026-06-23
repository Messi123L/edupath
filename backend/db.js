import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

export function hashPassword(password) {
  const salt = 'edupath_salt_1298';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

const cleanRow = (row) => {
  if (row === null || row === undefined) return row;
  const newRow = { ...row };
  if (newRow.estValide !== undefined) {
    newRow.estValide = !!newRow.estValide;
  }
  return newRow;
};

class Database {
  constructor() {
    this.pool = null;
    this.setupPromise = this.setup();
  }

  async setup() {
    try {
      const host = process.env.DB_HOST || 'localhost';
      const user = process.env.DB_USER || 'root';
      const password = process.env.DB_PASSWORD || '';
      const database = process.env.DB_NAME || 'edupath';

      // 1. Initial connection without database target to ensure DB exists
      const initConnection = await mysql.createConnection({
        host,
        user,
        password
      });

      await initConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
      await initConnection.end();

      // 2. Setup connection pool targeting 'edupath'
      this.pool = mysql.createPool({
        host,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      console.log(`[MySQL] Connecté à la base de données "${database}" avec succès.`);

      // 3. Create tables
      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS utilisateurs (
          id VARCHAR(100) PRIMARY KEY,
          nom VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          role VARCHAR(50) NOT NULL,
          motDePasse VARCHAR(255),
          specialite VARCHAR(255),
          niveauEtude VARCHAR(255),
          dateCreation VARCHAR(100) NOT NULL,
          dateModification VARCHAR(100)
        )
      `);

      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS ressources (
          id VARCHAR(100) PRIMARY KEY,
          titre VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          hashFichier VARCHAR(255),
          cheminFichier VARCHAR(255),
          creePar VARCHAR(100) NOT NULL,
          estValide TINYINT DEFAULT 0,
          dateCreation VARCHAR(100) NOT NULL,
          dateModification VARCHAR(100)
        )
      `);

      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS cartes_mentales (
          id VARCHAR(100) PRIMARY KEY,
          ressourceId VARCHAR(100) NOT NULL,
          noeudsJSON LONGTEXT NOT NULL,
          liensJSON LONGTEXT NOT NULL,
          dateCreation VARCHAR(100) NOT NULL,
          dateModification VARCHAR(100)
        )
      `);

      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS flashcards (
          id VARCHAR(100) PRIMARY KEY,
          ressourceId VARCHAR(100) NOT NULL,
          question TEXT NOT NULL,
          reponse TEXT NOT NULL,
          niveauBloom VARCHAR(100) NOT NULL,
          dateCreation VARCHAR(100) NOT NULL,
          dateModification VARCHAR(100)
        )
      `);

      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS jobs (
          id VARCHAR(100) PRIMARY KEY,
          ressourceId VARCHAR(100) NOT NULL,
          statut VARCHAR(50) NOT NULL,
          erreurMessage TEXT,
          dateCreation VARCHAR(100) NOT NULL,
          dateModification VARCHAR(100)
        )
      `);

      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS statistiques_apprentissage (
          id VARCHAR(100) PRIMARY KEY,
          etudiantId VARCHAR(100) NOT NULL,
          flashcardId VARCHAR(100) NOT NULL,
          repetitions INT DEFAULT 0,
          intervalle INT DEFAULT 0,
          scoreFacilite DOUBLE DEFAULT 2.5,
          dateProchaineRevision VARCHAR(100) NOT NULL,
          dateCreation VARCHAR(100) NOT NULL,
          dateModification VARCHAR(100)
        )
      `);

      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS commentaires (
          id VARCHAR(100) PRIMARY KEY,
          ressourceId VARCHAR(100) NOT NULL,
          auteurId VARCHAR(100) NOT NULL,
          auteurNom VARCHAR(255) NOT NULL,
          auteurRole VARCHAR(50) NOT NULL,
          contenu TEXT NOT NULL,
          dateCreation VARCHAR(100) NOT NULL
        )
      `);

      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS quizzes (
          id VARCHAR(100) PRIMARY KEY,
          ressourceId VARCHAR(100) NOT NULL,
          questionsJSON LONGTEXT NOT NULL,
          dateCreation VARCHAR(100) NOT NULL
        )
      `);

      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS podcasts (
          id VARCHAR(100) PRIMARY KEY,
          ressourceId VARCHAR(100) NOT NULL,
          dialogueJSON LONGTEXT NOT NULL,
          dateCreation VARCHAR(100) NOT NULL
        )
      `);

      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS translations (
          id VARCHAR(100) PRIMARY KEY,
          ressourceId VARCHAR(100) NOT NULL,
          lang VARCHAR(10) NOT NULL,
          assetType VARCHAR(50) NOT NULL,
          translatedJSON LONGTEXT NOT NULL,
          dateCreation VARCHAR(100) NOT NULL
        )
      `);

      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS notes (
          id VARCHAR(100) PRIMARY KEY,
          ressourceId VARCHAR(100) NOT NULL,
          etudiantId VARCHAR(100) NOT NULL,
          titre VARCHAR(255) NOT NULL,
          contenu TEXT NOT NULL,
          dateCreation VARCHAR(100) NOT NULL,
          dateModification VARCHAR(100)
        )
      `);

      // Alter table ressources to add columns contenuTexte and resume if they don't exist
      try {
        const [cols] = await this.pool.execute("SHOW COLUMNS FROM ressources LIKE 'contenuTexte'");
        if (cols.length === 0) {
          await this.pool.execute("ALTER TABLE ressources ADD COLUMN contenuTexte LONGTEXT");
          console.log("[MySQL] Colonne 'contenuTexte' ajoutée à la table ressources.");
        }
      } catch (e) {
        console.error("[MySQL] Erreur lors de l'ajout de la colonne 'contenuTexte':", e);
      }

      try {
        const [cols] = await this.pool.execute("SHOW COLUMNS FROM ressources LIKE 'resume'");
        if (cols.length === 0) {
          await this.pool.execute("ALTER TABLE ressources ADD COLUMN resume LONGTEXT");
          console.log("[MySQL] Colonne 'resume' ajoutée à la table ressources.");
        }
      } catch (e) {
        console.error("[MySQL] Erreur lors de l'ajout de la colonne 'resume':", e);
      }

      // Alter table utilisateurs to add column motDePasse if it doesn't exist
      try {
        const [cols] = await this.pool.execute("SHOW COLUMNS FROM utilisateurs LIKE 'motDePasse'");
        if (cols.length === 0) {
          await this.pool.execute("ALTER TABLE utilisateurs ADD COLUMN motDePasse VARCHAR(255)");
          console.log("[MySQL] Colonne 'motDePasse' ajoutée à la table utilisateurs.");
        }
      } catch (e) {
        console.error("[MySQL] Erreur lors de l'ajout de la colonne 'motDePasse':", e);
      }

      // Migration: Set a default password for any user with NULL password
      try {
        const [usersWithNullPassword] = await this.pool.execute("SELECT id FROM utilisateurs WHERE motDePasse IS NULL");
        if (usersWithNullPassword.length > 0) {
          const defaultHash = hashPassword('password123');
          for (const u of usersWithNullPassword) {
            await this.pool.execute("UPDATE utilisateurs SET motDePasse = ? WHERE id = ?", [defaultHash, u.id]);
          }
          console.log(`[MySQL] Migré ${usersWithNullPassword.length} utilisateurs avec le mot de passe par défaut.`);
        }
      } catch (e) {
        console.error("[MySQL] Erreur lors de la migration des mots de passe :", e);
      }

      // 4. Seeding & Migration if utilisateurs is empty
      const [users] = await this.pool.execute("SELECT * FROM utilisateurs LIMIT 1");
      if (users.length === 0) {
        console.log("[MySQL] Base de données vide. Initialisation...");

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const dbJsonPath = path.join(__dirname, 'data', 'db.json');
        let migrated = false;

        if (fs.existsSync(dbJsonPath)) {
          try {
            const fileContent = fs.readFileSync(dbJsonPath, 'utf-8');
            const data = JSON.parse(fileContent);
            console.log("[MySQL] Fichier db.json détecté. Migration des données...");

            if (data.utilisateurs && data.utilisateurs.length > 0) {
              for (const u of data.utilisateurs) await this.insert('utilisateurs', u);
            }
            if (data.ressources && data.ressources.length > 0) {
              for (const r of data.ressources) await this.insert('ressources', r);
            }
            if (data.cartes_mentales && data.cartes_mentales.length > 0) {
              for (const m of data.cartes_mentales) await this.insert('cartes_mentales', m);
            }
            if (data.flashcards && data.flashcards.length > 0) {
              for (const f of data.flashcards) await this.insert('flashcards', f);
            }
            if (data.jobs && data.jobs.length > 0) {
              for (const j of data.jobs) await this.insert('jobs', j);
            }
            if (data.statistiques_apprentissage && data.statistiques_apprentissage.length > 0) {
              for (const s of data.statistiques_apprentissage) await this.insert('statistiques_apprentissage', s);
            }

            console.log("[MySQL] Données migrées avec succès !");
            migrated = true;
          } catch (migrationErr) {
            console.error("[MySQL] Échec de la migration depuis db.json. Seeding par défaut...", migrationErr);
          }
        }

        if (!migrated) {
          console.log("[MySQL] Insertion des profils démo par défaut...");
          const DEFAULT_USERS = [
            {
              id: "u1",
              nom: "Prof. Jean Martin",
              email: "jean.martin@edupath.fr",
              role: "enseignant",
              motDePasse: hashPassword('jean123'),
              specialite: "Informatique & Technologies"
            },
            {
              id: "u2",
              nom: "Lucas Bernard",
              email: "lucas.bernard@etu.edupath.fr",
              role: "etudiant",
              motDePasse: hashPassword('lucas123'),
              niveauEtude: "Licence 3 Informatique"
            },
            {
              id: "u3",
              nom: "Directeur Administration",
              email: "admin@edupath.fr",
              role: "admin",
              motDePasse: hashPassword('admin123')
            }
          ];
          for (const u of DEFAULT_USERS) {
            await this.insert('utilisateurs', u);
          }
        }
      }

      // Migration to add real rich content to seeded resources if missing
      try {
        const [resources] = await this.pool.execute("SELECT id, contenuTexte FROM ressources");
        for (const res of resources) {
          if (!res.contenuTexte || res.contenuTexte.trim() === "" || res.contenuTexte === "NULL") {
            let richText = "";
            let summaryText = "";
            if (res.id === 'res_js_basics') {
              richText = `JavaScript Moderne (ES6+) a révolutionné le développement Web.
L'une des plus grandes nouveautés est l'introduction de 'let' et 'const' pour la déclaration des variables. Contrairement à 'var', qui possède une portée de fonction, 'let' et 'const' ont une portée de bloc. Cela empêche les variables de fuiter en dehors des blocs d'accolades {} (comme dans les conditions if ou les boucles for). De plus, 'const' permet de déclarer des constantes dont la liaison est immuable.
Une autre avancée majeure est la syntaxe des fonctions fléchées. Déclarées avec () => ..., elles sont non seulement plus courtes, mais elles ne lient pas leur propre contexte 'this' ; elles capturent le 'this' lexical de leur parent. C'est extrêmement pratique pour les callbacks et la manipulation d'événements.
ES6 introduit également la déstructuration d'objets et de tableaux, ainsi que les opérateurs Rest et Spread (...). Le Destructuring permet d'extraire proprement des propriétés dans des variables, par exemple const { name } = user. L'opérateur Spread permet de copier des objets de manière superficielle (shallow copy) ou de concaténer des tableaux, tandis que Rest permet de rassembler plusieurs arguments sous forme de tableau.
Enfin, la gestion de l'asynchronisme a été considérablement simplifiée grâce aux Promesses, qui représentent le succès ou l'échec d'une opération asynchrone, puis au sucre syntaxique async/await (introduit en ES8), permettant d'écrire du code asynchrone qui ressemble à du code synchrone avec try/catch.`;
              summaryText = `### 📄 Synthèse : JavaScript Moderne (ES6+)

Ce cours présente les évolutions majeures du langage JavaScript depuis la spécification ES6.

#### Concepts clés :
* **Portée de Bloc (let & const)** : Permet de déclarer des variables locales limitées au bloc d'accolades, évitant les fuites de variables.
* **Fonctions Fléchées** : Offre une syntaxe plus concise et capture lexicalement la valeur de 'this'.
* **Déstructuration & Rest/Spread** : Simplifie l'extraction de propriétés et la manipulation/clonage des structures de données.
* **Asynchronisme (Promises & Async/Await)** : Standardise la gestion des opérations asynchrones de manière lisible et évite le callback hell.`;
            } else if (res.id === 'res_git_basics') {
              richText = `Git est un système de contrôle de version décentralisé moderne et incontournable pour les développeurs.
Le fonctionnement de base de Git s'articule autour de trois zones logiques locales : le répertoire de travail (Working Directory) où vous modifiez vos fichiers, la zone de transit ou d'indexation (Staging Area) où vous préparez vos fichiers avec la commande git add, et le dépôt local (Repository) où vous enregistrez l'historique complet de votre projet sous forme de commits immuables via la commande git commit.
Un commit représente un instantané (snapshot) exact de votre projet à un instant T. Il est identifié par un hash SHA-1 unique et contient l'auteur, la date et un message de validation.
Pour travailler en parallèle, Git utilise des branches. Créer une branche avec git branch feature-name ou git checkout -b feature-name permet de travailler sur une fonctionnalité sans impacter la branche principale (main ou master). Une fois le travail terminé, on intègre les modifications à la branche principale avec git merge, ce qui peut parfois générer des conflits de fusion si les mêmes lignes ont été éditées simultanément. Les développeurs doivent alors résoudre manuellement ces conflits.
GitHub complète Git en fournissant une plateforme d'hébergement dans le cloud pour collaborer en équipe. La collaboration s'effectue via des Pull Requests (PR), qui permettent de proposer des fusions de code, de mener des relectures de code (Code Reviews) par ses pairs et d'exécuter des tests automatisés d'intégration continue avant d'intégrer le code à la branche de production.`;
              summaryText = `### 📄 Synthèse : Gestion de version avec Git & GitHub

Ce cours aborde les concepts fondamentaux du contrôle de version avec Git et de la collaboration sur GitHub.

#### Concepts clés :
* **Les 3 Zones Git** : Répertoire de travail (Working Directory), Zone d'indexation (Staging Area) et Dépôt local (Repository).
* **Commits et Historique** : Sauvegarde d'instantanés immuables identifiés par des hashs uniques pour suivre l'historique.
* **Gestion des Branches** : Travail isolé grâce aux commandes de création de branche et de fusion (git merge).
* **Collaboration & Pull Requests** : Processus de relecture de code et d'intégration collaborative via GitHub.`;
            }

            if (richText !== "") {
              await this.pool.execute(
                "UPDATE ressources SET contenuTexte = ?, resume = ? WHERE id = ?",
                [richText, summaryText, res.id]
              );
              console.log(`[MySQL Migration] Contenu textuel et résumé ensemencés pour le cours : ${res.id}`);
            }
          }
        }
      } catch (migrationErr) {
        console.error("[MySQL Migration] Erreur lors de la mise à jour des ressources par défaut :", migrationErr);
      }
    } catch (err) {
      console.error("[MySQL] Erreur d'initialisation :", err);
    }
  }

  async getPool() {
    if (this.pool) return this.pool;
    await this.setupPromise;
    return this.pool;
  }

  // Obtenir tous les enregistrements d'une table avec filtre optionnel en mémoire
  async find(table, filterFn = null) {
    const pool = await this.getPool();
    const [rows] = await pool.execute(`SELECT * FROM ${table}`);
    const mappedRows = rows.map(cleanRow);
    if (filterFn) {
      return mappedRows.filter(filterFn);
    }
    return mappedRows;
  }

  // Obtenir un seul enregistrement
  async findOne(table, filterFn) {
    const rows = await this.find(table);
    return rows.find(filterFn) || null;
  }

  // Insérer un enregistrement
  async insert(table, record) {
    const pool = await this.getPool();
    const id = record.id || `${table.substring(0, 3)}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const dateCreation = record.dateCreation || new Date().toISOString();
    
    // S'assurer que les valeurs JSON sont passées sous forme de chaîne de caractères
    const fullRecord = { ...record, id, dateCreation };
    
    const columns = Object.keys(fullRecord);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(fullRecord).map(val => {
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (val === undefined) return null;
      return val;
    });

    const sql = `INSERT INTO ${table} (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;
    await pool.execute(sql, values);
    return cleanRow(fullRecord);
  }

  // Mettre à jour un enregistrement
  async update(table, id, updates) {
    const pool = await this.getPool();
    const dateModification = new Date().toISOString();
    const fullUpdates = { ...updates, dateModification };
    
    const keys = Object.keys(fullUpdates);
    const values = Object.values(fullUpdates).map(val => {
      if (typeof val === 'boolean') return val ? 1 : 0;
      if (val === undefined) return null;
      return val;
    });

    const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
    
    await pool.execute(sql, [...values, id]);
    
    // Retourner l'enregistrement mis à jour
    const rows = await this.find(table, r => r.id === id);
    return rows[0] || null;
  }

  // Supprimer un enregistrement
  async delete(table, id) {
    const pool = await this.getPool();
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    const [result] = await pool.execute(sql, [id]);
    return result.affectedRows > 0;
  }
}

const db = new Database();
export default db;
