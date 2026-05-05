import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { BuildXmlOptions } from './hacienda.types';

const DOC_TYPE_MAP = {
  TE: { tag: 'TiqueteElectronico', xmlns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/tiqueteElectronico' },
  FE: { tag: 'FacturaElectronica', xmlns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica' },
  NC: { tag: 'NotaCreditoElectronica', xmlns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/notaCreditoElectronica' },
};

/**
 * Construye el XML sin firmar según el esquema v4.3 de Hacienda CR.
 * La firma XAdES se aplica después por XadesSignerService.
 */
@Injectable()
export class XmlBuilderService {
  build(opts: BuildXmlOptions): string {
    const { tag, xmlns } = DOC_TYPE_MAP[opts.docType];
    const dateStr = this.formatDate(opts.date);

    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele(tag, {
        xmlns,
        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      });

    root.ele('Clave').txt(opts.key);
    root.ele('CodigoActividad').txt('561101'); // Restaurantes con servicio
    root.ele('NumeroConsecutivo').txt(opts.consecutive);
    root.ele('FechaEmision').txt(dateStr);
    root.ele('CondicionVenta').txt(opts.saleCondition ?? '01');
    root.ele('MedioPago').txt(opts.paymentMethod);
    root.ele('PlazoCredito').txt('0');

    // ── Emisor ──────────────────────────────────────────────────────────────
    const emisor = root.ele('Emisor');
    emisor.ele('Nombre').txt(opts.issuerName);
    const idEmisor = emisor.ele('Identificacion');
    idEmisor.ele('Tipo').txt(opts.issuerTaxIdType);
    idEmisor.ele('Numero').txt(opts.issuerTaxId);
    if (opts.issuerCommercialName) {
      emisor.ele('NombreComercial').txt(opts.issuerCommercialName);
    }
    const ubica = emisor.ele('Ubicacion');
    ubica.ele('Provincia').txt(opts.issuerProvince);
    ubica.ele('Canton').txt(opts.issuerCanton);
    ubica.ele('Distrito').txt(opts.issuerDistrict);
    ubica.ele('OtrasSenas').txt(opts.issuerAddress);

    // ── Receptor (obligatorio en FE, opcional en TE) ─────────────────────
    if (opts.docType !== 'TE' && opts.receiverName) {
      const receptor = root.ele('Receptor');
      receptor.ele('Nombre').txt(opts.receiverName);
      if (opts.receiverTaxId) {
        const idReceptor = receptor.ele('Identificacion');
        idReceptor.ele('Tipo').txt(opts.receiverTaxIdType ?? '01');
        idReceptor.ele('Numero').txt(opts.receiverTaxId);
      }
      if (opts.receiverEmail) {
        receptor.ele('CorreoElectronico').txt(opts.receiverEmail);
      }
    }

    // ── Detalle de servicios/mercancías ──────────────────────────────────
    const detalle = root.ele('DetalleServicio');
    opts.lines.forEach((line, i) => {
      const item = detalle.ele('LineaDetalle');
      item.ele('NumeroLinea').txt(String(i + 1));

      const codeType = line.commercialCodeType ?? '04';
      const codeValue = line.commercialCode ?? String(i + 1);
      item.ele('Codigo').ele('Tipo').txt(codeType).up().ele('Codigo').txt(codeValue);
      if (line.cabysCode) {
        item.ele('CodigoCabys').txt(line.cabysCode);
      }

      item.ele('Detalle').txt(line.productName);
      item.ele('UnidadMedida').txt(line.unitOfMeasure ?? 'Sp');
      item.ele('Cantidad').txt(String(line.quantity));
      item.ele('PrecioUnitario').txt(this.fmt(line.unitPrice));
      item.ele('MontoTotal').txt(this.fmt(line.unitPrice * line.quantity));
      if (line.discount) {
        const desc = item.ele('Descuento');
        desc.ele('MontoDescuento').txt(this.fmt(line.discount));
        desc.ele('NaturalezaDescuento').txt('Descuento comercial');
      }
      item.ele('SubTotal').txt(this.fmt(line.unitPrice * line.quantity - (line.discount ?? 0)));

      if (line.taxRate > 0) {
        const imp = item.ele('Impuesto');
        imp.ele('Codigo').txt(line.taxCode ?? '01'); // IVA por defecto
        imp.ele('CodigoTarifa').txt(this.ivaTarifaCodigo(line.taxRate));
        imp.ele('Tarifa').txt(String(line.taxRate));
        imp.ele('Monto').txt(this.fmt((line.unitPrice * line.quantity - (line.discount ?? 0)) * line.taxRate / 100));
      }

      item.ele('MontoTotalLinea').txt(
        this.fmt((line.unitPrice * line.quantity - (line.discount ?? 0)) * (1 + line.taxRate / 100)),
      );
    });

    // ── ResumenFactura ────────────────────────────────────────────────────
    const resumen = root.ele('ResumenFactura');
    resumen.ele('CodigoTipoMoneda').ele('CodigoMoneda').txt('CRC').up().ele('TipoCambio').txt('1');
    resumen.ele('TotalServGravados').txt(this.fmt(opts.subtotal));
    resumen.ele('TotalMercanciasGravadas').txt('0.00');
    resumen.ele('TotalGravado').txt(this.fmt(opts.subtotal));
    resumen.ele('TotalDescuentos').txt(this.fmt(opts.discount));
    resumen.ele('TotalVentaNeta').txt(this.fmt(opts.subtotal - opts.discount));
    resumen.ele('TotalImpuesto').txt(this.fmt(opts.taxAmount));
    resumen.ele('TotalComprobante').txt(this.fmt(opts.total));

    return root.end({ prettyPrint: false });
  }

  private fmt(n: number): string {
    return n.toFixed(2);
  }

  private formatDate(d: Date): string {
    // ISO 8601 con offset Costa Rica (UTC-6)
    const offset = '-06:00';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${offset}`;
  }

  /** Código de tarifa de IVA según tabla Hacienda */
  private ivaTarifaCodigo(rate: number): string {
    const map: Record<number, string> = { 13: '08', 4: '04', 2: '02', 1: '01' };
    return map[rate] ?? '08';
  }
}
