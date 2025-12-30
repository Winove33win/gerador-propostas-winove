
import { jsPDF } from 'jspdf';
import { Proposal, Client, Company, Service, Term } from '../types';
import { api } from '../api.ts';

export const generateProposalPDF = async (proposal: Proposal) => {
  const doc = new jsPDF();
  let company: Company | null = null;
  let client: Client | null = null;
  let services: Service[] = [];
  let terms: Term[] = [];

  try {
    const [companyData, clientData, allServices, allTerms] = await Promise.all([
      api.companies.get(proposal.company_id),
      api.clients.get(proposal.client_id),
      api.services.list(),
      api.terms.list(),
    ]);
    company = companyData;
    client = clientData as Client;
    services = allServices.filter(s => proposal.services_ids.includes(s.id));
    terms = allTerms.filter(t => proposal.terms_ids.includes(t.id));
  } catch (error) {
    console.warn('Falha ao obter dados da proposta para PDF.', error);
  }

  const margin = 20;
  let y = margin;
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- CABEÇALHO ---
  doc.setFillColor(15, 23, 42); // Slate-900 (Fundo Escuro)
  doc.rect(0, 0, pageWidth, 50, 'F');

  // Desenho do Logo Winove (Hexágono Estilizado) usando doc.lines
  const logoX = margin;
  const logoY = 25;
  
  doc.setDrawColor(0, 163, 218);
  doc.setLineWidth(0.5);
  doc.setFillColor(0, 120, 200);
  
  const hx = logoX + 10;
  const hy = 25;
  const r = 12;
  
  const drawHex = (x: number, y: number, radius: number, style: string) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - (Math.PI / 6);
      points.push([
        radius * Math.cos(angle),
        radius * Math.sin(angle)
      ]);
    }
    const deltas = points.map((p, i) => {
      if (i === 0) return p;
      return [p[0] - points[i-1][0], p[1] - points[i-1][1]];
    });
    doc.lines(deltas, x + points[0][0], y + points[0][1], [1, 1], style, true);
  };

  doc.setFillColor(0, 80, 150);
  drawHex(hx + 1, hy + 1, r, 'F'); 
  doc.setFillColor(0, 163, 218);
  drawHex(hx, hy, r, 'F'); 
  
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.5);
  doc.line(hx - 4, hy - 4, hx + 4, hy - 4);
  doc.line(hx + 4, hy - 4, hx + 4, hy + 4);
  doc.line(hx + 4, hy + 4, hx - 4, hy + 4);
  doc.line(hx - 4, hy + 4, hx - 4, hy);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text('winove', logoX + 28, 28);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text('o  s e u  m u n d o', logoX + 29, 34);

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Proposta: ${proposal.number}`, pageWidth - margin, 20, { align: 'right' });
  doc.text(`Data: ${new Date(proposal.created_at).toLocaleDateString('pt-BR')}`, pageWidth - margin, 25, { align: 'right' });
  doc.text(`CNPJ: ${company?.cnpj || '29.900.423/0001-40'}`, pageWidth - margin, 30, { align: 'right' });

  y = 65;

  // --- CORPO DA PROPOSTA ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PARA:', margin, y);
  
  doc.setFont('helvetica', 'normal');
  const clientName = client?.name || 'Cliente Não Identificado';
  doc.text(clientName, margin + 15, y);
  y += 5;

  // Exibição do Contato e Cargo (A/C)
  if (client?.person_name) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(71, 85, 105);
    const contactText = `A/C: ${client.person_name}${client.job_title ? ` (${client.job_title})` : ''}`;
    doc.text(contactText, margin + 15, y);
    y += 5;
  }
  
  y += 5;

  const addInfoRow = (label: string, value: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 45, y);
    y += 7;
  };

  addInfoRow('Projeto:', proposal.platform || 'Desenvolvimento Web');
  addInfoRow('Domínio:', proposal.domain || 'A definir');
  addInfoRow('Prazo Estimado:', proposal.deadline || '20 Dias Úteis');
  addInfoRow('Validade da Proposta:', new Date(proposal.expiry_date).toLocaleDateString('pt-BR'));

  y += 10;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  // --- SERVIÇOS DETALHADOS ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 120, 200);
  doc.text('ESCOPO DOS SERVIÇOS', margin, y);
  y += 10;

  services.forEach((s, i) => {
    if (y > 250) { doc.addPage(); y = 25; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`${i + 1}. ${s.description}`, margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const desc = doc.splitTextToSize(s.detailed_description || '', pageWidth - (margin * 2));
    doc.text(desc, margin, y);
    y += (desc.length * 5) + 5;

    if (s.benefits && s.benefits.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Diferenciais inclusos:', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      s.benefits.forEach(b => {
        doc.text(`• ${b}`, margin + 5, y);
        y += 5;
      });
      y += 4;
    }
  });

  // --- INVESTIMENTO ---
  if (y > 230) { doc.addPage(); y = 25; }
  y += 10;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, pageWidth - (margin * 2), 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('RESUMO DE INVESTIMENTO', margin + 3, y + 6.5);
  doc.text('TOTAL', pageWidth - margin - 3, y + 6.5, { align: 'right' });
  y += 15;

  services.forEach(s => {
    doc.setFont('helvetica', 'normal');
    doc.text(s.description, margin + 3, y);
    doc.text(`R$ ${s.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 3, y, { align: 'right' });
    y += 8;
  });

  y += 8;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 120, 200);
  doc.text('VALOR TOTAL DO PROJETO:', margin + 3, y);
  doc.text(`R$ ${proposal.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 3, y, { align: 'right' });

  // --- PAGAMENTO ---
  y += 15;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CONDIÇÕES DE PAGAMENTO:', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const bank = company?.bank_info || 'PIX CNPJ: 29.900.423/0001-40 | Banco Caixa';
  doc.text(bank, margin, y);
  y += 5;
  doc.text('Disponível em até 10X no cartão de crédito via link de pagamento.', margin, y);

  // --- TERMOS E CONDIÇÕES ---
  doc.addPage();
  y = 25;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 120, 200);
  doc.text('TERMOS E CONDIÇÕES GERAIS', margin, y);
  y += 12;

  if (terms.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Esta proposta não possui termos específicos vinculados.', margin, y);
  } else {
    terms.forEach((t, i) => {
      if (y > 260) { doc.addPage(); y = 25; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${i + 1}. ${t.title.toUpperCase()}`, margin, y);
      y += 6;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(t.content, pageWidth - (margin * 2));
      doc.text(lines, margin, y);
      y += (lines.length * 4.5) + 8;
    });
  }

  // Numeração de Páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPages} | Winove Online - Tecnologia para o seu mundo`, pageWidth / 2, 285, { align: 'center' });
  }

  doc.save(`Proposta_Winove_${client?.name || 'Projeto'}.pdf`);
};
