import zipfile
import os

fixtures_dir = os.path.dirname(os.path.abspath(__file__))

# 1. Generate DOCX fixture
docx_path = os.path.join(fixtures_dir, "services-agreement.docx")

content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

doc_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>SERVICES AGREEMENT</w:t></w:r></w:p>
    <w:p><w:r><w:t>This Services Agreement is entered into by and between Provider and Client.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Section 1: Scope of Services</w:t></w:r></w:p>
    <w:p><w:r><w:t>Provider shall render software consulting and system maintenance services as described in the Statement of Work.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Section 2: Compensation and Payment</w:t></w:r></w:p>
    <w:p><w:r><w:t>Client agrees to pay all undisputed invoices within thirty (30) days from receipt.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Section 3: Term and Termination</w:t></w:r></w:p>
    <w:p><w:r><w:t>Either party may terminate this Agreement without cause upon giving sixty (60) days prior written notice.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Section 4: Limitation of Liability</w:t></w:r></w:p>
    <w:p><w:r><w:t>In no event shall either party's aggregate liability exceed the total fees paid under this Agreement during the preceding twelve (12) months.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Section 5: Governing Law</w:t></w:r></w:p>
    <w:p><w:r><w:t>This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.</w:t></w:r></w:p>
  </w:body>
</w:document>"""

with zipfile.ZipFile(docx_path, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", doc_xml)

print(f"Generated DOCX: {docx_path}")

# 2. Generate Encrypted PDF fixture
enc_path = os.path.join(fixtures_dir, "encrypted.pdf")
# A minimal PDF containing /Encrypt dictionary to trigger encrypted detection
enc_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
4 0 obj
<< /Filter /Standard /V 2 /R 3 /U (encrypted_user_key) /O (encrypted_owner_key) /P -4 >>
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000185 00000 n 
trailer
<< /Size 5 /Root 1 0 R /Encrypt 4 0 R >>
startxref
285
%%EOF
"""
with open(enc_path, "wb") as f:
    f.write(enc_content)
print(f"Generated Encrypted PDF: {enc_path}")

# 3. Generate Image-Only (no text) PDF fixture
img_path = os.path.join(fixtures_dir, "image-only.pdf")
# A valid PDF with an empty page and no text
img_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer
<< /Size 4 /Root 1 0 R >>
startxref
185
%%EOF
"""
with open(img_path, "wb") as f:
    f.write(img_content)
print(f"Generated Image-Only PDF: {img_path}")
