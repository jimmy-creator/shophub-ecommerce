import PDFDocument from 'pdfkit';

const storeName = process.env.STORE_NAME || 'ShopHub';
const storeState = process.env.STORE_STATE || '';
const storeEmail = process.env.SMTP_EMAIL || '';
const storeGSTIN = process.env.STORE_GSTIN || '';
const storeAddress = process.env.STORE_ADDRESS || '';
const storePhone = process.env.STORE_PHONE || '';

function formatPrice(amount) {
  return `Rs.${parseFloat(amount).toFixed(2)}`;
}

export function generateInvoice(order) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const items = order.items || [];
      const address = order.shippingAddress || {};
      const taxBreakdown = order.taxBreakdown || null;
      const discount = parseFloat(order.discount) || 0;
      const taxAmount = parseFloat(order.taxAmount) || 0;
      const totalAmount = parseFloat(order.totalAmount);

      // Colors
      const dark = '#1a1614';
      const copper = '#c4784a';
      const grey = '#8a7e76';
      const lightGrey = '#e8e0d8';
      const bg = '#faf8f5';

      // ===== HEADER =====
      doc.rect(0, 0, 595.28, 100).fill(dark);

      doc.fontSize(22).fill('#ffffff').font('Helvetica-Bold')
        .text(storeName, 50, 35, { width: 250 });

      doc.fontSize(24).fill(copper).font('Helvetica-Bold')
        .text('INVOICE', 400, 30, { width: 150, align: 'right' });

      doc.fontSize(9).fill('#999999')
        .text(`#${order.orderNumber}`, 400, 58, { width: 150, align: 'right' });

      doc.fontSize(9).fill('#999999')
        .text(new Date(order.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric',
        }), 400, 72, { width: 150, align: 'right' });

      let y = 120;

      // ===== STORE & CUSTOMER INFO =====
      // From (Store)
      doc.fontSize(8).fill(copper).font('Helvetica-Bold')
        .text('FROM', 50, y);
      y += 14;
      doc.fontSize(10).fill(dark).font('Helvetica-Bold')
        .text(storeName, 50, y);
      y += 14;
      doc.fontSize(9).fill(grey).font('Helvetica');
      if (storeAddress) { doc.text(storeAddress, 50, y); y += 12; }
      if (storeState) { doc.text(storeState, 50, y); y += 12; }
      if (storePhone) { doc.text(`Phone: ${storePhone}`, 50, y); y += 12; }
      if (storeEmail) { doc.text(`Email: ${storeEmail}`, 50, y); y += 12; }
      if (storeGSTIN) { doc.text(`GSTIN: ${storeGSTIN}`, 50, y); y += 12; }

      // To (Customer)
      let yRight = 120;
      doc.fontSize(8).fill(copper).font('Helvetica-Bold')
        .text('BILL TO', 350, yRight);
      yRight += 14;
      doc.fontSize(10).fill(dark).font('Helvetica-Bold')
        .text(address.fullName || 'Customer', 350, yRight);
      yRight += 14;
      doc.fontSize(9).fill(grey).font('Helvetica');
      if (address.address) { doc.text(address.address, 350, yRight); yRight += 12; }
      const cityLine = [address.city, address.state, address.zipCode].filter(Boolean).join(', ');
      if (cityLine) { doc.text(cityLine, 350, yRight); yRight += 12; }
      if (address.phone) { doc.text(`Phone: ${address.phone}`, 350, yRight); yRight += 12; }
      if (order.guestEmail) { doc.text(`Email: ${order.guestEmail}`, 350, yRight); yRight += 12; }

      y = Math.max(y, yRight) + 20;

      // ===== ORDER DETAILS BAR =====
      doc.rect(50, y, 495.28, 28).fill(bg);
      doc.fontSize(8).fill(grey).font('Helvetica-Bold');
      doc.text('ORDER NUMBER', 60, y + 8);
      doc.text('DATE', 200, y + 8);
      doc.text('PAYMENT', 310, y + 8);
      doc.text('STATUS', 430, y + 8);

      y += 28;
      doc.fontSize(9).fill(dark).font('Helvetica');
      doc.text(order.orderNumber, 60, y + 6);
      doc.text(new Date(order.createdAt).toLocaleDateString('en-IN'), 200, y + 6);
      doc.text((order.paymentMethod || 'N/A').toUpperCase(), 310, y + 6);

      const statusText = (order.paymentStatus || 'pending').toUpperCase();
      const statusColor = order.paymentStatus === 'paid' ? '#5a8a6a' : copper;
      doc.fontSize(9).fill(statusColor).font('Helvetica-Bold')
        .text(statusText, 430, y + 6);

      y += 30;

      // ===== LINE SEPARATOR =====
      doc.moveTo(50, y).lineTo(545.28, y).lineWidth(1).strokeColor(lightGrey).stroke();
      y += 10;

      // ===== ITEMS TABLE HEADER =====
      doc.rect(50, y, 495.28, 24).fill(dark);
      doc.fontSize(8).fill('#ffffff').font('Helvetica-Bold');
      doc.text('#', 60, y + 7, { width: 20 });
      doc.text('ITEM', 80, y + 7, { width: 200 });
      doc.text('HSN', 280, y + 7, { width: 50 });
      doc.text('QTY', 335, y + 7, { width: 40, align: 'center' });
      doc.text('RATE', 380, y + 7, { width: 70, align: 'right' });
      doc.text('AMOUNT', 460, y + 7, { width: 80, align: 'right' });
      y += 24;

      // ===== ITEMS ROWS =====
      items.forEach((item, i) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        const isEven = i % 2 === 0;
        if (isEven) {
          doc.rect(50, y, 495.28, 26).fill(bg);
        }

        doc.fontSize(9).fill(dark).font('Helvetica');
        doc.text(String(i + 1), 60, y + 8, { width: 20 });

        // Item name + variant
        let itemName = item.name;
        if (item.variant) {
          const variantParts = Object.entries(item.variant)
            .filter(([k]) => k !== 'sku')
            .map(([k, v]) => `${k}: ${v}`);
          if (variantParts.length) itemName += ` (${variantParts.join(', ')})`;
        }
        doc.text(itemName, 80, y + 8, { width: 195 });

        doc.fontSize(8).fill(grey);
        doc.text(item.hsnCode || '-', 280, y + 8, { width: 50 });

        doc.fontSize(9).fill(dark);
        doc.text(String(item.quantity), 335, y + 8, { width: 40, align: 'center' });
        doc.text(formatPrice(item.price), 380, y + 8, { width: 70, align: 'right' });
        doc.text(formatPrice(item.price * item.quantity), 460, y + 8, { width: 80, align: 'right' });

        y += 26;
      });

      y += 10;
      doc.moveTo(50, y).lineTo(545.28, y).lineWidth(0.5).strokeColor(lightGrey).stroke();
      y += 15;

      // ===== TOTALS =====
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const labelX = 350;
      const valueX = 460;
      const rowHeight = 18;

      doc.fontSize(9).fill(grey).font('Helvetica');
      doc.text('Subtotal', labelX, y, { width: 100 });
      doc.fill(dark).text(formatPrice(subtotal), valueX, y, { width: 80, align: 'right' });
      y += rowHeight;

      if (discount > 0) {
        doc.fill(grey).text(`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, labelX, y, { width: 100 });
        doc.fill('#5a8a6a').text(`-${formatPrice(discount)}`, valueX, y, { width: 80, align: 'right' });
        y += rowHeight;
      }

      if (taxAmount > 0 && taxBreakdown) {
        if (taxBreakdown.isSameState) {
          doc.fill(grey).text('CGST', labelX, y, { width: 100 });
          doc.fill(dark).text(formatPrice(taxBreakdown.cgst), valueX, y, { width: 80, align: 'right' });
          y += rowHeight;
          doc.fill(grey).text('SGST', labelX, y, { width: 100 });
          doc.fill(dark).text(formatPrice(taxBreakdown.sgst), valueX, y, { width: 80, align: 'right' });
          y += rowHeight;
        } else {
          doc.fill(grey).text('IGST', labelX, y, { width: 100 });
          doc.fill(dark).text(formatPrice(taxBreakdown.igst), valueX, y, { width: 80, align: 'right' });
          y += rowHeight;
        }

        doc.fill(grey).fontSize(8)
          .text('(Tax included in price)', labelX, y, { width: 200 });
        y += rowHeight;
      }

      // Total bar
      y += 5;
      doc.rect(labelX - 10, y, 205.28, 30).fill(dark);
      doc.fontSize(11).fill('#ffffff').font('Helvetica-Bold')
        .text('TOTAL', labelX, y + 8, { width: 90 });
      doc.text(formatPrice(totalAmount), valueX, y + 8, { width: 80, align: 'right' });

      y += 50;

      // ===== FOOTER =====
      if (y > 700) { doc.addPage(); y = 50; }

      doc.moveTo(50, y).lineTo(545.28, y).lineWidth(0.5).strokeColor(lightGrey).stroke();
      y += 15;

      doc.fontSize(8).fill(grey).font('Helvetica');
      doc.text('Thank you for your purchase!', 50, y, { width: 495.28, align: 'center' });
      y += 14;
      doc.text(`${storeName} • ${storeEmail}${storeGSTIN ? ` • GSTIN: ${storeGSTIN}` : ''}`, 50, y, { width: 495.28, align: 'center' });
      y += 14;
      doc.text('This is a computer-generated invoice and does not require a signature.', 50, y, { width: 495.28, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default { generateInvoice };
