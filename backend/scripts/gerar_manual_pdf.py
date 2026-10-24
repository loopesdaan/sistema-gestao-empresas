#!/usr/bin/env python3
"""
Gera o manual executivo do sistema em formato PDF formatado a partir de MANUAL_SISTEMA.md
"""

import os
import re
import html
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfgen import canvas

def formatar_markdown_inline(texto):
    # Escapa caracteres HTML
    texto = html.escape(texto)
    # Substitui **texto** por <b>texto</b>
    texto = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', texto)
    # Substitui `codigo` por <font face="Courier">codigo</font>
    texto = re.sub(r'`(.*?)`', r'<font face="Courier" color="#0369A1"><b>\1</b></font>', texto)
    return texto

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        # Rodapé
        rodape = f"Manual do Sistema de Gestão Comercial • Página {self._pageNumber} de {page_count}"
        self.drawRightString(A4[0] - 40, 25, rodape)
        self.drawString(40, 25, "Confidencial & Proprietário • SaaS Gestão PME")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(40, 35, A4[0] - 40, 35)
        self.restoreState()

def gerar_pdf(caminho_md, caminho_pdf):
    doc = SimpleDocTemplate(
        caminho_pdf,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=40,
        bottomMargin=45
    )

    styles = getSampleStyleSheet()

    # Estilos customizados
    titulo_style = ParagraphStyle(
        'DocTitulo',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=6
    )

    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=12,
        spaceAfter=4,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'DocH3',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#0284C7"),
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True
    )

    corpo_style = ParagraphStyle(
        'DocCorpo',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'DocBullet',
        parent=corpo_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )

    story = []

    # Banner / Cabeçalho Inicial
    story.append(Paragraph("Sistema de Gestão Comercial Multi-Segmento", titulo_style))
    story.append(Paragraph("Manual de Arquitetura, Conformidade Trabalhista CLT & Operação", h3_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284C7"), spaceAfter=12))

    with open(caminho_md, "r", encoding="utf-8") as f:
        linhas = f.readlines()

    ignorar_linhas = 0
    in_code_block = False
    code_lines = []

    for linha in linhas:
        l = linha.strip()

        # Pula cabeçalho inicial que já adicionamos manualmente
        if l.startswith("# Manual do Sistema"):
            continue

        if l.startswith("```"):
            if in_code_block:
                # Fecha bloco de código
                codigo_txt = "<br/>".join(code_lines)
                code_style = ParagraphStyle('Code', parent=corpo_style, fontName='Courier', fontSize=7.5, leading=10, textColor=colors.HexColor("#1E293B"))
                t = Table([[Paragraph(codigo_txt, code_style)]], colWidths=[A4[0] - 80])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
                    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
                    ('PADDING', (0,0), (-1,-1), 6),
                ]))
                story.append(t)
                story.append(Spacer(1, 6))
                code_lines = []
                in_code_block = False
            else:
                in_code_block = True
                code_lines = []
            continue

        if in_code_block:
            code_lines.append(l.replace("<", "&lt;").replace(">", "&gt;"))
            continue

        if not l:
            story.append(Spacer(1, 4))
            continue

        if l.startswith("## "):
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0"), spaceBefore=8, spaceAfter=4))
            story.append(Paragraph(formatar_markdown_inline(l[3:]), h2_style))
        elif l.startswith("### "):
            story.append(Paragraph(formatar_markdown_inline(l[4:]), h3_style))
        elif l.startswith("- ") or l.startswith("* "):
            texto = formatar_markdown_inline(l[2:])
            story.append(Paragraph(f"• {texto}", bullet_style))
        elif l.startswith("---"):
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceBefore=6, spaceAfter=6))
        else:
            texto = formatar_markdown_inline(l)
            story.append(Paragraph(texto, corpo_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF gerado com sucesso em: {caminho_pdf}")

if __name__ == "__main__":
    raiz = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    md = os.path.join(raiz, "MANUAL_SISTEMA.md")
    pdf = os.path.join(raiz, "MANUAL_SISTEMA.pdf")
    gerar_pdf(md, pdf)
