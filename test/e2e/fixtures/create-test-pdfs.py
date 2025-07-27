#!/usr/bin/env python3
"""Create test PDF files for E2E tests"""

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
import os

# Create output directory
output_dir = "pdfs"
os.makedirs(output_dir, exist_ok=True)

# 1. Simple Text PDF
def create_simple_text_pdf():
    c = canvas.Canvas(f"{output_dir}/simple-text.pdf", pagesize=letter)
    width, height = letter
    
    # Title
    c.setFont("Helvetica-Bold", 24)
    c.drawString(100, height - 100, "Simple Text Document")
    
    # Paragraphs
    c.setFont("Helvetica", 12)
    y = height - 150
    
    paragraphs = [
        "This is a simple PDF document created for testing purposes.",
        "It contains several paragraphs of text that can be extracted and analyzed.",
        "The PDF Intelligence Platform should be able to detect these text zones.",
        "Each paragraph represents a distinct content zone.",
        "Zone detection and extraction should work correctly on this document."
    ]
    
    for i, para in enumerate(paragraphs, 1):
        c.drawString(100, y, f"Paragraph {i}: {para}")
        y -= 30
    
    c.save()
    print("Created simple-text.pdf")

# 2. Complex Tables PDF
def create_complex_tables_pdf():
    doc = SimpleDocTemplate(f"{output_dir}/complex-tables.pdf", pagesize=letter)
    story = []
    styles = getSampleStyleSheet()
    
    # Title
    story.append(Paragraph("Complex Tables Document", styles['Title']))
    story.append(Spacer(1, 12))
    
    # Introduction text
    story.append(Paragraph("This document contains multiple tables for testing table extraction.", styles['Normal']))
    story.append(Spacer(1, 12))
    
    # Table 1: Financial Data
    data1 = [
        ['Quarter', 'Revenue', 'Expenses', 'Profit'],
        ['Q1 2024', '$125,000', '$80,000', '$45,000'],
        ['Q2 2024', '$150,000', '$90,000', '$60,000'],
        ['Q3 2024', '$175,000', '$95,000', '$80,000'],
        ['Q4 2024', '$200,000', '$100,000', '$100,000'],
        ['Total', '$650,000', '$365,000', '$285,000']
    ]
    
    t1 = Table(data1)
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(Paragraph("Table 1: Financial Summary", styles['Heading2']))
    story.append(t1)
    story.append(Spacer(1, 24))
    
    # Text between tables
    for i in range(10):
        story.append(Paragraph(f"This is text paragraph {i+1} between the tables. It contains important information that should be extracted as a separate zone.", styles['Normal']))
        story.append(Spacer(1, 12))
    
    # Table 2: Product Data
    data2 = [
        ['Product', 'Category', 'Price', 'Stock'],
        ['Widget A', 'Hardware', '$25.99', '150'],
        ['Widget B', 'Hardware', '$35.99', '200'],
        ['Software X', 'Software', '$99.99', 'Unlimited'],
        ['Service Y', 'Service', '$49.99/mo', 'N/A']
    ]
    
    t2 = Table(data2)
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.blue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(Paragraph("Table 2: Product Inventory", styles['Heading2']))
    story.append(t2)
    story.append(Spacer(1, 24))
    
    # More text
    story.append(Paragraph("Additional content after the tables.", styles['Normal']))
    story.append(Paragraph("This tests the ability to handle mixed content types.", styles['Normal']))
    
    # Table 3 on new page
    story.append(PageBreak())
    story.append(Paragraph("Table 3: Employee Data", styles['Heading2']))
    
    data3 = [
        ['Name', 'Department', 'Role', 'Start Date'],
        ['John Doe', 'Engineering', 'Senior Developer', '2020-01-15'],
        ['Jane Smith', 'Marketing', 'Marketing Manager', '2019-06-20'],
        ['Bob Johnson', 'Sales', 'Sales Representative', '2021-03-10']
    ]
    
    t3 = Table(data3)
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.green),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(t3)
    
    doc.build(story)
    print("Created complex-tables.pdf")

# 3. Multi-page PDF
def create_multi_page_pdf():
    c = canvas.Canvas(f"{output_dir}/multi-page.pdf", pagesize=letter)
    width, height = letter
    
    for page_num in range(1, 6):
        # Page header
        c.setFont("Helvetica-Bold", 18)
        c.drawString(100, height - 50, f"Page {page_num} of 5")
        
        # Content
        c.setFont("Helvetica", 12)
        y = height - 100
        
        for i in range(15):
            c.drawString(100, y, f"Page {page_num}, Line {i+1}: This is content that spans multiple pages.")
            y -= 25
            
            if i == 7:
                # Add a text box
                c.rect(90, y - 50, 400, 40)
                c.drawString(100, y - 30, "This is a highlighted text box on page " + str(page_num))
                y -= 60
        
        # Page footer
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(250, 30, f"Multi-page Test Document - Page {page_num}")
        
        if page_num < 5:
            c.showPage()
    
    c.save()
    print("Created multi-page.pdf")

# 4. Large document (simulate)
def create_large_document_pdf():
    # For testing, create a reasonably sized document
    c = canvas.Canvas(f"{output_dir}/large-document.pdf", pagesize=letter)
    width, height = letter
    
    # Just create 10 pages with lots of text
    for page_num in range(1, 11):
        c.setFont("Helvetica-Bold", 16)
        c.drawString(100, height - 50, f"Large Document - Section {page_num}")
        
        c.setFont("Helvetica", 10)
        y = height - 80
        
        for i in range(40):
            c.drawString(50, y, f"Line {i+1}: " + "This is a large document with lots of content. " * 3)
            y -= 15
            
            if y < 50:
                break
        
        if page_num < 10:
            c.showPage()
    
    c.save()
    print("Created large-document.pdf")

# 5. With images (text describing images)
def create_with_images_pdf():
    c = canvas.Canvas(f"{output_dir}/with-images.pdf", pagesize=letter)
    width, height = letter
    
    c.setFont("Helvetica-Bold", 24)
    c.drawString(100, height - 100, "Document with Images")
    
    c.setFont("Helvetica", 12)
    y = height - 150
    
    # Image placeholder 1
    c.rect(100, y - 150, 200, 150)
    c.drawString(150, y - 75, "[Image 1: Chart]")
    
    y -= 170
    c.drawString(100, y, "Figure 1: This represents a data visualization chart.")
    
    y -= 50
    
    # Text content
    c.drawString(100, y, "The image above shows important data trends.")
    
    y -= 30
    
    # Image placeholder 2
    c.rect(350, y - 100, 150, 100)
    c.drawString(380, y - 50, "[Image 2: Logo]")
    
    y -= 120
    c.drawString(100, y, "Additional text content after the images.")
    
    c.save()
    print("Created with-images.pdf")

# 6. Corrupted PDF (create a file that's not a valid PDF)
def create_corrupted_pdf():
    with open(f"{output_dir}/corrupted.pdf", 'wb') as f:
        f.write(b'%PDF-1.4\n')
        f.write(b'This is not a valid PDF file structure\n')
        f.write(b'It should cause an error when processed\n')
        f.write(b'%%EOF')
    print("Created corrupted.pdf")

# Create all PDFs
if __name__ == "__main__":
    print("Creating test PDF files...")
    create_simple_text_pdf()
    create_complex_tables_pdf()
    create_multi_page_pdf()
    create_large_document_pdf()
    create_with_images_pdf()
    create_corrupted_pdf()
    print("\nAll test PDFs created successfully!")