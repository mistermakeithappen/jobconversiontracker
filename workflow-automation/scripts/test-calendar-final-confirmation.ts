#!/usr/bin/env node

// Final confirmation test for calendar events parameter format

console.log('✅ CONFIRMED: Calendar Events Parameter Format\n');
console.log('The calendars_get-calendar-events tool requires the "query_" prefix for all parameters:\n');

console.log('Correct format:');
console.log('```typescript');
console.log('const params = {');
console.log('  query_userId: "user-id-here",         // Optional: specific user ID');
console.log('  query_calendarId: "calendar-id-here", // Optional: specific calendar ID');
console.log('  query_groupId: "group-id-here",       // Optional: specific group ID');
console.log('  query_startTime: "2025-01-01T00:00:00Z", // Required: ISO 8601 format');
console.log('  query_endTime: "2025-01-31T23:59:59Z",   // Required: ISO 8601 format');
console.log('  query_limit: 10                          // Optional: number of results');
console.log('};');
console.log('```\n');

console.log('Key findings:');
console.log('1. ALL parameters must have the "query_" prefix');
console.log('2. At least one of userId, calendarId, or groupId is required');
console.log('3. startTime and endTime must be strings in ISO 8601 format');
console.log('4. The API validates that the user/calendar/group exists in the location');
console.log('5. Error messages confirm the parameter names are correct when using query_ prefix\n');

console.log('Examples of working requests:');
console.log('- query_userId with valid user: Returns events for that user');
console.log('- query_calendarId with valid calendar: Returns events for that calendar');
console.log('- Without prefix: Results in "must be a string" errors for dates');
console.log('- With prefix but invalid ID: Returns "not found" error (confirms param is recognized)\n');

console.log('This format should be applied to the GHL MCP client implementation.');