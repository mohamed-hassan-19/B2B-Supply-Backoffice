import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface InvoiceDetailProps {
  invoiceId: number;
  apiPath: string; // e.g. '/api/admin/invoices' or '/api/storefront/invoices'
}

export function InvoiceDetail({ invoiceId, apiPath }: InvoiceDetailProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      const res = await api.get(`${apiPath}/${invoiceId}`);
      return res.data;
    }
  });

  if (isLoading) return <div className="p-4">Loading invoice details...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load invoice.</div>;
  if (!data) return null;

  const { invoice, client, items, order } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-gray-100 text-gray-800 border-transparent';
      case 'void': return 'bg-white text-gray-800 border-gray-200';
      default: return 'bg-gray-900 text-gray-50 border-transparent';
    }
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 text-left" style={{ direction: 'ltr' }}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl font-bold">INVOICE</h3>
          <p className="text-sm text-gray-500 mt-1">
            Invoice Number: {invoice.invoice_number || `#${invoice.id}`}
          </p>
          <p className="text-sm text-gray-500">
            Date: {new Date(invoice.createdAt).toLocaleDateString()}
          </p>
          {invoice.sales_order_reference && (
            <p className="text-sm text-gray-500">
              Sales Order Ref: {invoice.sales_order_reference}
            </p>
          )}
          <p className="text-sm text-gray-500">
            Payment Method: {invoice.payment_method === 'COD' ? 'Cash on Delivery' : invoice.payment_method}
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${getStatusColor(invoice.payment_status)}`}>
            {invoice.payment_status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
        <h4 className="font-semibold mb-2 border-b pb-1 text-gray-900">Bill To:</h4>
        <p className="font-medium text-gray-900">{client.company_name}</p>
        <p className="text-sm text-gray-700">{client.email}</p>
        {client.commercial_registration && (
          <p className="text-sm text-gray-700">CR: {client.commercial_registration}</p>
        )}
        {client.tax_registration && (
          <p className="text-sm text-gray-700">Tax ID: {client.tax_registration}</p>
        )}
      </div>

      <div className="w-full overflow-auto">
        <table className="w-full caption-bottom text-sm border-b">
          <thead className="[&_tr]:border-b border-gray-200 text-gray-500">
            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Item</th>
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Qty</th>
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Unit Price</th>
              <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Total</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0 border-gray-200 text-gray-900">
            {items.map((item: any) => (
              <tr key={item.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <td className="p-4 align-middle">{item.product_name}</td>
                <td className="p-4 align-middle text-right">{item.quantity}</td>
                <td className="p-4 align-middle text-right">£{Number(item.unit_price).toFixed(2)}</td>
                <td className="p-4 align-middle text-right">£{(Number(item.unit_price) * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-4">
        <div className="w-64 space-y-2 text-gray-900">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>£{Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          {order && order.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Discount:</span>
              <span>-£{Number(order.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span>Tax ({(Number(invoice.tax_rate) * 100).toFixed(0)}%):</span>
            <span>£{Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
            <span>Grand Total:</span>
            <span>£{Number(invoice.grand_total).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
