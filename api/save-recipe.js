import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Seul le POST est autorisé' });
  }

  // On récupère les données envoyées par ton site React
  const { recipe_name, water_quantity, duration } = req.body;

  try {
    // Connexion à ta base Alwaysdata via tes variables d'environnement (.env)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // Écriture dans la table RECIPE avec les bons noms de colonnes
    // CURDATE() insère automatiquement la date d'aujourd'hui
    const [result] = await connection.execute(
      'INSERT INTO RECIPE (recipe_name, water_quantity, duration, creation_date) VALUES (?, ?, ?, CURDATE())',
      [recipe_name, water_quantity, duration]
    );

    await connection.end(); // Fermeture de la connexion

    // On renvoie un succès avec l'ID de la recette qui vient d'être créée
    return res.status(200).json({ success: true, id_recipe: result.insertId });
  } catch (error) {
    console.error("Erreur SQL :", error);
    return res.status(500).json({ error: "Erreur lors de l'écriture en base" });
  }
}