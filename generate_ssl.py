"""
SSL Certificate Generator for Chatter FilePro
Generates a self-signed certificate for HTTPS on local network
"""

import os
import sys
import subprocess
import socket
import ipaddress

def get_local_ip():
    """Get the local IP address of this machine"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def generate_certificate(ip_address=None):
    """Generate self-signed SSL certificate"""
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        import datetime
        
        local_ip = ip_address if ip_address else get_local_ip()
        
        print(f"Generating certificate for IP: {local_ip}")
        
        # Generate private key
        key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        # Generate certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Local"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "Local"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "ChatterFilePro"),
            x509.NameAttribute(NameOID.COMMON_NAME, local_ip),
        ])
        
        # Build Subject Alternative Names
        san_list = [
            x509.DNSName("localhost"),
            x509.DNSName(local_ip),
            x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
        ]
        
        # Add the local IP as IP address SAN
        try:
            san_list.append(x509.IPAddress(ipaddress.IPv4Address(local_ip)))
        except:
            pass
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.datetime.utcnow()
        ).not_valid_after(
            datetime.datetime.utcnow() + datetime.timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName(san_list),
            critical=False,
        ).sign(key, hashes.SHA256(), default_backend())
        
        # Write certificate
        with open("cert.pem", "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        
        # Write private key
        with open("key.pem", "wb") as f:
            f.write(key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        print(f"✅ Certificate generated for: localhost, {local_ip}")
        return True
        
    except ImportError:
        print("Installing cryptography package...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "cryptography"])
        print("Please run this script again!")
        return False

if __name__ == "__main__":
    print("🔐 Generating SSL Certificate for Local-LAN-Messenger...")
    print()
    
    # Check if IP was passed as argument
    ip_arg = sys.argv[1] if len(sys.argv) > 1 else None
    
    if ip_arg:
        print(f"📍 Using IP from argument: {ip_arg}")
    else:
        ip_arg = get_local_ip()
        print(f"📍 Detected Local IP: {ip_arg}")
    
    print()
    
    if generate_certificate(ip_arg):
        print()
        print("=" * 50)
        print("✅ SSL Certificate generated successfully!")
        print()
        print("Files created:")
        print("  - cert.pem (certificate)")
        print("  - key.pem (private key)")
        print()
        print("Now run: start_https_server.bat")
        print("=" * 50)
