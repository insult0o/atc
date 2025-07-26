#!/usr/bin/env python3
"""
Health check script for Unstructured Docker container
"""
import sys
import json
import tempfile
import os
from pathlib import Path

def create_test_pdf():
    """Create a minimal test PDF for health check"""
    try:
        # Create a simple test PDF using reportlab if available
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
        temp_file.close()
        
        c = canvas.Canvas(temp_file.name, pagesize=letter)
        c.drawString(100, 750, "Health Check Test Document")
        c.drawString(100, 700, "This is a test document for container health check.")
        c.save()
        
        return temp_file.name
    except ImportError:
        # Fallback: create a fake PDF file for basic import testing
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf', mode='w')
        temp_file.write("%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n")
        temp_file.write("2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n")
        temp_file.write("3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\n")
        temp_file.write("xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000125 00000 n \n")
        temp_file.write("trailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n213\n%%EOF")
        temp_file.close()
        return temp_file.name

def test_imports():
    """Test critical imports"""
    try:
        import unstructured
        import json
        import pickle
        import sys
        import os
        print("✓ Critical imports successful")
        return True
    except ImportError as e:
        print(f"✗ Import failed: {e}")
        return False

def test_unstructured_processing():
    """Test basic unstructured processing"""
    try:
        from unstructured.partition.auto import partition
        
        # Create test file
        test_file = create_test_pdf()
        
        # Test processing
        elements = partition(filename=test_file, strategy="fast")
        
        # Clean up
        os.unlink(test_file)
        
        if elements:
            print(f"✓ Unstructured processing successful ({len(elements)} elements)")
            return True
        else:
            print("✗ Unstructured processing returned no elements")
            return False
            
    except Exception as e:
        print(f"✗ Unstructured processing failed: {e}")
        return False

def test_enhanced_processor():
    """Test the enhanced processor script"""
    try:
        # Test if the enhanced processor script exists and is executable
        processor_path = Path("/app/lib/python/enhanced_unstructured_processor.py")
        
        if not processor_path.exists():
            print("✗ Enhanced processor script not found")
            return False
            
        if not os.access(processor_path, os.X_OK):
            print("✗ Enhanced processor script not executable")
            return False
            
        print("✓ Enhanced processor script ready")
        return True
        
    except Exception as e:
        print(f"✗ Enhanced processor check failed: {e}")
        return False

def test_directories():
    """Test required directories"""
    try:
        required_dirs = [
            Path("/app/temp"),
            Path("/app/cache"),
            Path("/app/lib/python")
        ]
        
        for dir_path in required_dirs:
            if not dir_path.exists():
                print(f"✗ Required directory missing: {dir_path}")
                return False
                
        print("✓ Required directories present")
        return True
        
    except Exception as e:
        print(f"✗ Directory check failed: {e}")
        return False

def main():
    """Main health check function"""
    print("🔍 Starting Unstructured container health check...")
    
    checks = [
        ("Import Test", test_imports),
        ("Directory Test", test_directories),
        ("Enhanced Processor Test", test_enhanced_processor),
        ("Unstructured Processing Test", test_unstructured_processing)
    ]
    
    all_passed = True
    
    for check_name, check_func in checks:
        print(f"\n📋 Running {check_name}...")
        try:
            if not check_func():
                all_passed = False
        except Exception as e:
            print(f"✗ {check_name} failed with exception: {e}")
            all_passed = False
    
    if all_passed:
        print("\n✅ All health checks passed!")
        sys.exit(0)
    else:
        print("\n❌ Some health checks failed!")
        sys.exit(1)

if __name__ == "__main__":
    main() 