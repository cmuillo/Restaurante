import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

/**
 * Firma documentos XML con el certificado de Firma Digital del BCCR
 * usando el estándar XAdES-BES (requerido por Hacienda CR).
 *
 * El archivo .p12 se carga desde la ruta definida en HACIENDA_P12_PATH.
 * La clave de apertura del .p12 está en HACIENDA_P12_PASSWORD.
 */
@Injectable()
export class XadesSignerService implements OnModuleInit {
  private readonly logger = new Logger(XadesSignerService.name);
  private privateKey: string;
  private certificate: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const p12Path = this.config.get<string>('HACIENDA_P12_PATH');
    const p12Password = this.config.get<string>('HACIENDA_P12_PASSWORD');

    if (!p12Path || !p12Password) {
      this.logger.warn(
        'HACIENDA_P12_PATH o HACIENDA_P12_PASSWORD no configurados — la firma electrónica está deshabilitada',
      );
      return;
    }

    try {
      const p12Buffer = readFileSync(p12Path);
      const p12Der = forge.util.decode64(p12Buffer.toString('base64'));
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12Password);

      const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const certBag = p12.getBags({ bagType: forge.pki.oids.certBag });

      const keyObj = keyBag[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
      const certObj = certBag[forge.pki.oids.certBag]?.[0]?.cert;

      if (!keyObj || !certObj) {
        this.logger.error('No se pudo extraer la llave o el certificado del archivo .p12');
        return;
      }

      this.privateKey = forge.pki.privateKeyToPem(keyObj);
      this.certificate = forge.pki.certificateToPem(certObj);

      this.logger.log('Certificado de Firma Digital cargado correctamente');
    } catch (err) {
      this.logger.error(`Error cargando el archivo .p12: ${err.message}`);
    }
  }

  isReady(): boolean {
    return !!(this.privateKey && this.certificate);
  }

  /**
   * Carga el certificado desde una ruta y contraseña (usado desde el servicio al subir .p12 por UI).
   * Retorna true si se cargó correctamente.
   */
  async loadFromPath(p12Path: string, password: string): Promise<boolean> {
    try {
      const p12Buffer = readFileSync(p12Path);
      const p12Der = forge.util.decode64(p12Buffer.toString('base64'));
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const certBag = p12.getBags({ bagType: forge.pki.oids.certBag });

      const keyObj = keyBag[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
      const certObj = certBag[forge.pki.oids.certBag]?.[0]?.cert;

      if (!keyObj || !certObj) {
        this.logger.error('No se pudo extraer llave/certificado del .p12');
        return false;
      }

      this.privateKey = forge.pki.privateKeyToPem(keyObj);
      this.certificate = forge.pki.certificateToPem(certObj);
      this.logger.log(`Certificado cargado desde ${p12Path}`);
      return true;
    } catch (err) {
      this.logger.error(`Error cargando .p12 desde ${p12Path}: ${err.message}`);
      return false;
    }
  }

  /**
   * Firma el XML con XAdES-BES y retorna el XML firmado como string.
   * Si el certificado no está configurado, retorna el XML sin firmar.
   */
  sign(xmlString: string): string {
    if (!this.isReady()) {
      this.logger.warn('Firma digital no disponible — enviando XML sin firmar (modo contingencia)');
      return xmlString;
    }

    const sig = new SignedXml({ privateKey: this.privateKey });

    // Algoritmos requeridos por Hacienda CR (RSA-SHA256 + enveloped-signature)
    sig.addReference({
      xpath: '//*[local-name(.)="FacturaElectronica" or local-name(.)="TiqueteElectronico" or local-name(.)="NotaCreditoElectronica"]',
      transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    });

    sig.signingKey = this.privateKey;
    sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';

    // Incluir certificado en el XML firmado
    const certDer = this.certificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    sig.keyInfoProvider = {
      getKeyInfo: () =>
        `<X509Data><X509Certificate>${certDer}</X509Certificate></X509Data>`,
      getKey: () => Buffer.from(this.privateKey),
    };

    sig.computeSignature(xmlString);
    return sig.getSignedXml();
  }
}
