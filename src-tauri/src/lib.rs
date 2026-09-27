use tauri_plugin_sql::{Migration, MigrationKind};

/// Nom du fichier SQLite local, résolu par Tauri dans le répertoire de données de l'application
/// (ex. `%APPDATA%/com.jeccamtech.ecole/` sous Windows) — jamais dans le dossier d'installation, pour
/// survivre aux mises à jour de l'auto-updater.
const DB_URL: &str = "sqlite:jeccam-ecole.db";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "creation_table_encaissements_offline",
            // Schéma tel que spécifié initialement — jamais modifié en place (voir migration 3 pour
            // les colonnes ajoutées ensuite : SQLite n'autorise qu'un ALTER TABLE ADD COLUMN à la fois,
            // jamais une modification rétroactive d'une migration déjà appliquée sur un poste en prod).
            sql: r#"
                CREATE TABLE IF NOT EXISTS encaissements_offline (
                    id                TEXT PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    eleve_id          INTEGER NOT NULL,
                    montant           REAL NOT NULL,
                    date_paiement     TEXT NOT NULL,
                    synced            INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_encaissements_offline_synced
                    ON encaissements_offline (synced);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "creation_tables_referentiel_local",
            // Miroir local (lecture seule, écrasé à chaque `pullReferenceData`) des données nécessaires
            // pour qu'un encaissement puisse être saisi hors ligne : classes, élèves, frais scolaires et
            // factures (pour connaître le reste à payer sans réseau). Alimenté depuis Next.js via
            // `@tauri-apps/plugin-sql`, jamais directement par le binaire Rust.
            sql: r#"
                CREATE TABLE IF NOT EXISTS classes (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    annee_scolaire_id INTEGER,
                    niveau_id         INTEGER,
                    nom               TEXT NOT NULL,
                    effectif          INTEGER,
                    capacite_max      INTEGER
                );
                CREATE TABLE IF NOT EXISTS eleves (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    classe_id         INTEGER,
                    matricule         TEXT,
                    nom               TEXT NOT NULL,
                    prenom            TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS frais_scolaires (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    classe_id         INTEGER,
                    type              TEXT NOT NULL,
                    libelle           TEXT,
                    montant           REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS factures (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    eleve_id          INTEGER NOT NULL,
                    frais_id          INTEGER,
                    reference         TEXT,
                    montant_total     REAL NOT NULL,
                    montant_paye      REAL NOT NULL DEFAULT 0,
                    solde_restant     REAL NOT NULL DEFAULT 0,
                    statut            TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_eleves_classe ON eleves (classe_id);
                CREATE INDEX IF NOT EXISTS idx_factures_eleve ON factures (eleve_id);
                CREATE INDEX IF NOT EXISTS idx_frais_classe ON frais_scolaires (classe_id);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "encaissements_offline_colonnes_synchronisation",
            // Le schéma d'origine (migration 1) suffit à ENREGISTRER un encaissement, mais pas à le
            // POUSSER vers l'API Java (POST /api/v1/paiements exige une facture, un canal et un
            // encaisseur) : ajoutées séparément plutôt que dans la migration 1 pour ne jamais réécrire
            // une migration déjà appliquée sur un poste déjà installé.
            sql: r#"
                ALTER TABLE encaissements_offline ADD COLUMN facture_id INTEGER;
                ALTER TABLE encaissements_offline ADD COLUMN mode_paiement TEXT NOT NULL DEFAULT 'CASH';
                ALTER TABLE encaissements_offline ADD COLUMN collecte_par_user_id INTEGER;
                ALTER TABLE encaissements_offline ADD COLUMN tentatives INTEGER NOT NULL DEFAULT 0;
                ALTER TABLE encaissements_offline ADD COLUMN derniere_erreur TEXT;
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "creation_tables_referentiel_local_etendu",
            // Complète le miroir de la migration 2 avec ce qu'il faut pour naviguer/saisir hors ligne
            // côté enseignement (cahier de texte, présences) et finances (dépenses) : enseignants,
            // matières, affectations classe/matière/enseignant, emploi du temps, fiches de dépense
            // mensuelles ouvertes (les LIGNES de dépense restent une file d'attente, voir migration 5 —
            // seule la fiche elle-même, créée en ligne, est mise en cache ici en lecture).
            sql: r#"
                CREATE TABLE IF NOT EXISTS enseignants (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    matricule         TEXT,
                    nom               TEXT NOT NULL,
                    prenom            TEXT NOT NULL,
                    telephone         TEXT
                );
                CREATE TABLE IF NOT EXISTS matieres (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    libelle           TEXT NOT NULL,
                    coefficient       REAL
                );
                CREATE TABLE IF NOT EXISTS classe_matieres (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    classe_id         INTEGER NOT NULL,
                    matiere_id        INTEGER NOT NULL,
                    enseignant_id     INTEGER
                );
                CREATE TABLE IF NOT EXISTS emploi_du_temps (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    classe_id         INTEGER NOT NULL,
                    matiere_id        INTEGER,
                    enseignant_id     INTEGER,
                    salle_id          INTEGER,
                    jour              TEXT NOT NULL,
                    heure_debut       TEXT NOT NULL,
                    heure_fin         TEXT NOT NULL,
                    libelle           TEXT
                );
                CREATE TABLE IF NOT EXISTS fiches_depense (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    libelle           TEXT NOT NULL,
                    annee_scolaire    TEXT,
                    cloturee          INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_classe_matieres_classe ON classe_matieres (classe_id);
                CREATE INDEX IF NOT EXISTS idx_emploi_du_temps_classe ON emploi_du_temps (classe_id);
                CREATE INDEX IF NOT EXISTS idx_emploi_du_temps_enseignant ON emploi_du_temps (enseignant_id);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "creation_files_attente_presences_seances_depenses",
            // Trois nouvelles files d'attente hors ligne, même forme que `encaissements_offline` : id
            // UUID généré côté client (idempotence), `synced`/`tentatives`/`derniere_erreur` pour le
            // rejeu. `id_serveur` (séances/dépenses) se remplit après le PREMIER envoi réussi : un
            // enseignant peut ouvrir une séance "PLANNED" un jour hors ligne, puis la marquer "DONE"
            // (avec une durée réalisée différente) un autre jour AVANT toute synchronisation — sans
            // id_serveur, impossible de savoir plus tard si la seconde ligne modifie la première ou en
            // crée une nouvelle une fois en ligne.
            sql: r#"
                CREATE TABLE IF NOT EXISTS presences_offline (
                    id                TEXT PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    type_sujet        TEXT NOT NULL,
                    sujet_id          INTEGER NOT NULL,
                    direction         TEXT,
                    date_action       TEXT NOT NULL,
                    heure             TEXT,
                    saisie_manuelle   INTEGER NOT NULL DEFAULT 0,
                    synced            INTEGER NOT NULL DEFAULT 0,
                    tentatives        INTEGER NOT NULL DEFAULT 0,
                    derniere_erreur   TEXT
                );
                CREATE TABLE IF NOT EXISTS seances_offline (
                    id                TEXT PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    id_serveur        INTEGER,
                    classe_id         INTEGER NOT NULL,
                    matiere_id        INTEGER,
                    enseignant_id     INTEGER,
                    date_seance       TEXT NOT NULL,
                    titre             TEXT NOT NULL,
                    contenu           TEXT,
                    devoirs           TEXT,
                    duree_minutes     INTEGER,
                    statut            TEXT NOT NULL DEFAULT 'PLANNED',
                    synced            INTEGER NOT NULL DEFAULT 0,
                    tentatives        INTEGER NOT NULL DEFAULT 0,
                    derniere_erreur   TEXT
                );
                CREATE TABLE IF NOT EXISTS depenses_offline (
                    id                TEXT PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    id_serveur        INTEGER,
                    fiche_id          INTEGER NOT NULL,
                    libelle           TEXT NOT NULL,
                    montant           REAL NOT NULL,
                    necessaire        INTEGER NOT NULL DEFAULT 0,
                    date_depense      TEXT NOT NULL,
                    synced            INTEGER NOT NULL DEFAULT 0,
                    tentatives        INTEGER NOT NULL DEFAULT 0,
                    derniere_erreur   TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_presences_offline_synced ON presences_offline (synced);
                CREATE INDEX IF NOT EXISTS idx_seances_offline_synced ON seances_offline (synced);
                CREATE INDEX IF NOT EXISTS idx_depenses_offline_synced ON depenses_offline (synced);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "creation_tables_referentiel_complement",
            // Petites tables de contexte, peu volumineuses mais référencées par les tables précédentes
            // (niveau_id, salle_id, annee_scolaire_id) ou nécessaires pour qu'un enseignant retrouve SES
            // évaluations à noter hors ligne (voir migration 7, notes_offline).
            sql: r#"
                CREATE TABLE IF NOT EXISTS annees_scolaires (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    libelle           TEXT NOT NULL,
                    courante          INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS niveaux (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    libelle           TEXT NOT NULL,
                    ordre             INTEGER
                );
                CREATE TABLE IF NOT EXISTS salles (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    libelle           TEXT NOT NULL,
                    batiment          TEXT
                );
                CREATE TABLE IF NOT EXISTS evaluations (
                    id                INTEGER PRIMARY KEY,
                    etablissement_id  INTEGER NOT NULL,
                    classe_id         INTEGER NOT NULL,
                    matiere_id        INTEGER NOT NULL,
                    periode_id        INTEGER NOT NULL,
                    libelle           TEXT NOT NULL,
                    note_sur          REAL NOT NULL,
                    coefficient       REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_evaluations_classe ON evaluations (classe_id);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "creation_files_attente_notes_et_caisse",
            // `notes_offline` : une ligne par ÉVALUATION (pas par élève, ni par note individuelle) — le
            // endpoint serveur `/grading/assessments/{id}/grades/bulk` est un UPSERT complet de toutes
            // les notes de la classe pour cette évaluation, donc une nouvelle saisie hors ligne pour la
            // MÊME évaluation REMPLACE la ligne précédente au lieu de s'empiler (identique à
            // `gradeQueue` côté web, voir db.ts) : `notes_json` contient `[{studentId, value}, ...]`
            // (SQLite n'a pas de type tableau natif, cf. tauri-plugin-sql/sqlite).
            //
            // `caisse_sessions_offline` : ouverture/fermeture de la caisse du comptable. Le TOTAL
            // SYSTÈME officiel (somme de tous les encaissements de la session) ne peut être connu avec
            // certitude qu'une fois SYNCHRONISÉ — `total_systeme_provisoire` est une estimation calculée
            // localement (encaissements déjà connus de cette machine), affichée à l'écran avec la mention
            // "provisoire" tant que `synced = 0` ; ne jamais la présenter comme un chiffre définitif.
            sql: r#"
                CREATE TABLE IF NOT EXISTS notes_offline (
                    evaluation_id       INTEGER PRIMARY KEY,
                    etablissement_id    INTEGER NOT NULL,
                    notes_json          TEXT NOT NULL,
                    synced              INTEGER NOT NULL DEFAULT 0,
                    tentatives          INTEGER NOT NULL DEFAULT 0,
                    derniere_erreur     TEXT
                );
                CREATE TABLE IF NOT EXISTS caisse_sessions_offline (
                    id                        TEXT PRIMARY KEY,
                    etablissement_id          INTEGER NOT NULL,
                    id_serveur                INTEGER,
                    ouverte_le                TEXT NOT NULL,
                    fermee_le                 TEXT,
                    comptage_physique         REAL,
                    total_systeme_provisoire  REAL,
                    notes                     TEXT,
                    synced                    INTEGER NOT NULL DEFAULT 0,
                    tentatives                INTEGER NOT NULL DEFAULT 0,
                    derniere_erreur           TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_notes_offline_synced ON notes_offline (synced);
                CREATE INDEX IF NOT EXISTS idx_caisse_sessions_offline_synced ON caisse_sessions_offline (synced);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "creation_file_attente_inscriptions",
            // File d'attente automatique pour "Nouvelle inscription" (parent + un ou plusieurs
            // enfants en une soumission) : une ligne par SOUMISSION, pas par enfant, car le parent est
            // partagé. `parent_json` porte soit un id déjà résolu (parent existant/personnel choisi en
            // ligne), soit les champs à créer (mode "nouveau parent"/"personnel" sans id encore connu).
            // `enfants_json` porte un tableau d'enfants avec, PAR ENFANT, à la fois les champs saisis ET
            // la progression déjà accomplie (studentId, parentLinked, enrolled, exemptionApplied,
            // transportSubscribed, feesGenerated) — sans quoi une synchro interrompue en cours de route
            // (ex. après la création de l'élève mais avant l'inscription) rejouerait tout depuis zéro au
            // prochain essai et créerait un second élève en double (même raisonnement que
            // `caisse_sessions_offline`/migration 7 pour la clôture après ouverture déjà connue).
            sql: r#"
                CREATE TABLE IF NOT EXISTS inscriptions_offline (
                    id                  TEXT PRIMARY KEY,
                    etablissement_id    INTEGER NOT NULL,
                    annee_scolaire_id   INTEGER NOT NULL,
                    parent_json         TEXT NOT NULL,
                    enfants_json        TEXT NOT NULL,
                    synced              INTEGER NOT NULL DEFAULT 0,
                    tentatives          INTEGER NOT NULL DEFAULT 0,
                    derniere_erreur     TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_inscriptions_offline_synced ON inscriptions_offline (synced);
            "#,
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de l'application Jeccam École");
}
