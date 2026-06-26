/**
 * Protected application routes used by the unauthorized direct-URL guard test
 * (Azure Login case 6875). An unauthenticated user hitting any of these must be
 * redirected to the login page.
 *
 * GUID-bearing routes use the example IDs from the manual test case; the redirect
 * happens before any resource lookup, so the specific IDs do not need to be valid.
 *
 * Keep this list in sync with case 6875 in the Azure "Login" suite (plan 30937).
 */
export const PROTECTED_ROUTES: readonly string[] = [
  '/Home',
  '/CallListing/cd4fd9a4-6318-4b99-be0b-23c1a53afe25',
  '/details/b47b1aaa-d3ae-ee11-bea0-000d3a4f4b34/cd4fd9a4-6318-4b99-be0b-23c1a53afe25',
  '/ChatListing',
  '/Reporting',
  '/ClientHeartbeats',
  '/QADashboard',
  '/QAScorecards',
  '/SecurityLogs',
  '/Settings/General',
  '/Settings/UserManagement',
  '/Settings/CustomUserRoles',
  '/Settings/RestrictedUserRoles',
  '/Settings/SiteManagement',
  '/Settings/AgentManagement',
  '/Settings/AssignAgents',
  '/Settings/AgentGroups',
  '/Settings/ExtensionManagement',
  '/Settings/CallTags',
  '/Settings/QARandomizer',
  '/Settings/Notifications',
  '/Settings/RetentionPolicy',
  '/Settings/GridManagement',
  '/Settings/IpWhitelist',
  '/Settings/Phonebook',
  '/Dashboards',
  '/AiAgent',
  '/Alerting',
  '/ChartConfigurator',
  '/AnalyticsSettings',
  '/PartnerView',
  '/ManageUsers',
  '/Branding',
  '/PartnerLogs',
  '/PartnerSettings',
  '/AdminReport',
  '/SiteMonitoring',
  '/CustomerMonitoring',
  '/Heartbeats',
  '/LastCallReport',
  '/PendingLogs',
  '/ReceivedLogs',
  '/RemoteDiagnostics',
  '/Partner',
  '/BillingReport',
  '/BillingReportOld',
  '/Plans',
  '/Update',
  '/AuditLogs',
  '/SystemAdminManagement',
  '/MarketplaceSubscription',
];
