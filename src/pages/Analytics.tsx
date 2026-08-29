import { AlertTriangle } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Analytics & Reports</h2>
      
      <div className="bg-amber-50 border border-amber-200 rounded-md p-6 flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-medium text-amber-800 mb-2">Reporting Endpoints Not Found</h3>
        <p className="text-amber-700">
          The backend API currently does not expose endpoints for analytics or financial reporting. 
          This page has been stubbed out. Once the backend team builds the analytics API (planned for future phases), 
          we can connect this page to display charts and reports.
        </p>
      </div>
    </div>
  );
}
