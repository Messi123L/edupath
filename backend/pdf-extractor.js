import fs from 'fs';
import pdf from 'pdf-parse';

/**
 * Extrait le texte d'un fichier PDF
 * @param {string} filePath Chemin absolu du fichier PDF
 * @returns {Promise<string>} Le texte extrait du PDF
 */
export async function extractTextFromPDF(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier introuvable à l'emplacement : ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
    // Nettoyer le texte extrait (suppression des espaces multiples)
    const cleanedText = data.text
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedText) {
      return "Le document PDF semble être vide ou contient uniquement des images numérisées sans OCR.";
    }

    return cleanedText;
  } catch (error) {
    console.error("Erreur lors de l'extraction du PDF :", error);
    throw new Error(`Impossible d'extraire le contenu du PDF : ${error.message}`);
  }
}
