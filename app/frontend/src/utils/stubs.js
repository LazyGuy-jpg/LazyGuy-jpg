// Temporary stub components for pages not yet implemented

export const PageStub = ({ title, description }) => (
  <div className="max-w-4xl mx-auto">
    <div className="card text-center py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-600">{description}</p>
    </div>
  </div>
);

// User Pages
export const CallLogsStub = () => PageStub({ 
  title: 'Call Logs', 
  description: 'View your call history and details' 
});

export const CountryPricesStub = () => PageStub({ 
  title: 'Country Prices', 
  description: 'View calling rates by country' 
});

export const DocumentationStub = () => PageStub({ 
  title: 'API Documentation', 
  description: 'Learn how to integrate with our API' 
});

export const SettingsStub = () => PageStub({ 
  title: 'Account Settings', 
  description: 'Manage your account preferences' 
});

// Admin Pages
export const AdminDashboardStub = () => PageStub({ 
  title: 'Admin Dashboard', 
  description: 'System overview and analytics' 
});

export const ApiKeysStub = () => PageStub({ 
  title: 'API Keys Management', 
  description: 'Manage user API keys' 
});

export const RegistrationsStub = () => PageStub({ 
  title: 'User Registrations', 
  description: 'Manage user registrations' 
});

export const AdminCallLogsStub = () => PageStub({ 
  title: 'System Call Logs', 
  description: 'View all system call logs' 
});

export const AdminCountryPricesStub = () => PageStub({ 
  title: 'Country Pricing Management', 
  description: 'Set and update country calling rates' 
});

export const BonusRulesStub = () => PageStub({ 
  title: 'Bonus Rules', 
  description: 'Manage bonus rules and promotions' 
});

export const AdminDocumentationStub = () => PageStub({ 
  title: 'Documentation Management', 
  description: 'Edit API documentation' 
});

export const AdminSettingsStub = () => PageStub({ 
  title: 'System Settings', 
  description: 'Configure system settings' 
});