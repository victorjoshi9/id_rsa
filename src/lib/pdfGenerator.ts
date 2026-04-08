import { jsPDF } from "jspdf";
import "jspdf-autotable";

interface ThesisData {
  title: string;
  branch: string;
  sections: Record<string, string>;
}

export const generateThesisPDF = async (thesis: ThesisData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // Title Page
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  const titleLines = doc.splitTextToSize(thesis.title.toUpperCase(), contentWidth);
  doc.text(titleLines, pageWidth / 2, 60, { align: "center" });

  doc.setFontSize(14);
  doc.text(`A THESIS SUBMITTED IN PARTIAL FULFILLMENT OF THE REQUIREMENTS`, pageWidth / 2, 120, { align: "center" });
  doc.text(`FOR THE DEGREE OF M.TECH IN`, pageWidth / 2, 130, { align: "center" });
  doc.setFontSize(16);
  doc.text(thesis.branch.toUpperCase(), pageWidth / 2, 140, { align: "center" });

  doc.setFontSize(12);
  doc.text(`BY`, pageWidth / 2, 180, { align: "center" });
  doc.setFontSize(14);
  doc.text(`RESEARCH STUDENT`, pageWidth / 2, 190, { align: "center" });

  doc.setFontSize(12);
  doc.text(`DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING`, pageWidth / 2, 240, { align: "center" });
  doc.text(`ACADEMIC YEAR 2025-2026`, pageWidth / 2, 250, { align: "center" });

  // Table of Contents
  doc.addPage();
  doc.setFontSize(18);
  doc.text("TABLE OF CONTENTS", margin, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  
  let tocY = 50;
  Object.keys(thesis.sections).forEach((section, index) => {
    doc.text(`${index + 1}. ${section}`, margin, tocY);
    doc.text(`${index + 2}`, pageWidth - margin, tocY, { align: "right" });
    tocY += 10;
  });

  // Content Pages
  Object.entries(thesis.sections).forEach(([title, content]) => {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title.toUpperCase(), margin, 30);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const splitContent = doc.splitTextToSize(content, contentWidth);
    
    let currentY = 45;
    splitContent.forEach((line: string) => {
      if (currentY > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
      }
      doc.text(line, margin, currentY);
      currentY += 7;
    });

    // Add simulated "Deep Research" pages
    for (let i = 0; i < 5; i++) {
        doc.addPage();
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text(`[Technical Appendix - Section ${title} - Part ${i+1}]`, margin, 20);
        doc.setFont("helvetica", "normal");
        doc.text("Extended analysis and data points generated for academic depth...", margin, 40);
    }
  });

  // Save the PDF
  doc.save(`${thesis.title.substring(0, 20)}_Thesis.pdf`);
};
