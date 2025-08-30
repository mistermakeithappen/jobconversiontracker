'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Plus, 
  X,
  Clock,
  User,
  MapPin,
  FileText,
  CalendarDays,
  Search,
  Filter,
  DollarSign
} from 'lucide-react';
import { 
  format, 
  addDays, 
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  isWeekend,
  parseISO
} from 'date-fns';

interface GHLCalendar {
  id: string;
  name: string;
  description?: string;
  type?: string;
  teamMembers?: string[]; // Array of user IDs assigned to this calendar
}

interface TeamMember {
  id: string;
  external_id?: string;
  ghl_user_id?: string;
  full_name: string;
  email: string;
}

interface Opportunity {
  opportunity_id: string;
  title: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  stage?: string;
  pipeline_stage_id?: string;
  pipeline_name?: string;
  monetary_value?: number;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

interface PipelineStage {
  id: string;
  name: string;
  position: number;
}

interface Appointment {
  id: string;
  appointment_id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  assigned_to?: string;
  team_member?: TeamMember;
  opportunity?: Opportunity;
  description?: string;
  internal_notes?: string;
  calendar_id: string;
}

export default function CalendarPage() {
  const [calendars, setCalendars] = useState<GHLCalendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<GHLCalendar | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<string>('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Schedule form state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('10:00');
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  
  // Calendar view state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  
  // Enhanced opportunity selection state
  const [opportunityTab, setOpportunityTab] = useState<'existing' | 'new'>('existing');
  const [opportunitySearchTerm, setOpportunitySearchTerm] = useState('');
  const [selectedPipelineStage, setSelectedPipelineStage] = useState('');
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newOpportunityTitle, setNewOpportunityTitle] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [newOpportunityValue, setNewOpportunityValue] = useState('');

  // Fetch data on mount
  useEffect(() => {
    fetchCalendars();
    syncAndFetchTeamMembers();
    fetchOpportunities(); // This also fetches pipelines
    fetchAllAppointments();
  }, []);

  // Refresh appointments when month changes
  useEffect(() => {
    fetchAllAppointments();
  }, [currentMonth]);
  
  // Debounced contact search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (contactSearchTerm) {
        fetchContacts(contactSearchTerm);
      } else {
        setContacts([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [contactSearchTerm]);

  const fetchCalendars = async () => {
    try {
      const response = await fetch('/api/ghl/calendars');
      if (!response.ok) {
        console.error('Calendar API error:', response.status);
        return;
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Invalid response type from calendars API');
        return;
      }
      const data = await response.json();
      if (data.calendars) {
        setCalendars(data.calendars);
      }
    } catch (error) {
      console.error('Error fetching calendars:', error);
    }
  };

  const syncAndFetchTeamMembers = async () => {
    try {
      // First sync GHL users to team_members table
      console.log('Syncing GHL users to team members...');
      const syncResponse = await fetch('/api/team-members/sync-ghl', {
        method: 'POST'
      });
      
      if (syncResponse.ok) {
        const syncData = await syncResponse.json();
        console.log('Sync result:', syncData);
      } else {
        console.error('Sync failed:', await syncResponse.text());
      }
      
      // Now fetch the team members
      const response = await fetch('/api/team-members');
      
      if (!response.ok) {
        console.error('Team members API error:', response.status);
        return;
      }
      
      const data = await response.json();
      
      if (data.members) {
        console.log(`Fetched ${data.members.length} team members`);
        setTeamMembers(data.members);
      } else {
        setTeamMembers([]);
      }
    } catch (error) {
      console.error('Error syncing/fetching team members:', error);
    }
  };

  const fetchOpportunities = async () => {
    try {
      const response = await fetch('/api/integrations/automake/opportunities');
      if (!response.ok) {
        console.error('Opportunities API error:', response.status);
        return;
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Invalid response type from opportunities API');
        return;
      }
      const data = await response.json();
      
      // Set pipelines if they're included in the response
      if (data.pipelines) {
        console.log('Pipelines from opportunities API:', data.pipelines);
        setPipelines(data.pipelines.map((pipeline: any) => ({
          id: pipeline.id,
          name: pipeline.name,
          stages: pipeline.stages || []
        })));
      }
      
      if (data.opportunities) {
        setOpportunities(data.opportunities.map((opp: any) => ({
          opportunity_id: opp.id,
          title: opp.title || opp.name,
          contact_name: opp.contactName || opp.contact?.name || 'Unknown Contact',
          contact_email: opp.contact?.email,
          contact_phone: opp.contact?.phone,
          stage: opp.stageName || opp.stage,
          pipeline_stage_id: opp.pipelineStageId,
          pipeline_name: opp.pipelineName,
          monetary_value: opp.monetaryValue
        })));
      }
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    }
  };

  const fetchPipelines = async () => {
    try {
      const response = await fetch('/api/ghl/pipelines');
      if (!response.ok) {
        console.error('Pipelines API error:', response.status);
        return;
      }
      const data = await response.json();
      if (data.pipelines) {
        const processedPipelines = data.pipelines.map((pipeline: any) => ({
          id: pipeline.id,
          name: pipeline.name,
          stages: pipeline.stages || []
        }));
        console.log('Fetched pipelines with stages:', processedPipelines);
        setPipelines(processedPipelines);
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error);
    }
  };

  const fetchContacts = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setContacts([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/integrations/automake/contacts?search=${encodeURIComponent(searchTerm)}&limit=10`);
      if (!response.ok) {
        console.error('Contacts API error:', response.status);
        return;
      }
      const data = await response.json();
      if (data.contacts) {
        setContacts(data.contacts);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchAllAppointments = async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);
      
      const response = await fetch(
        `/api/ghl/appointments?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      
      if (!response.ok) {
        console.error('Appointments API error:', response.status);
        return;
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Invalid response type from appointments API');
        return;
      }
      
      const data = await response.json();
      if (data.appointments) {
        setAppointments(data.appointments);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncAppointments = async () => {
    setSyncing(true);
    try {
      // Sync all calendars
      for (const calendar of calendars) {
        await fetch('/api/ghl/appointments/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendarId: calendar.id })
        });
      }
      
      await fetchAllAppointments();
      alert('Successfully synced all calendars');
    } catch (error) {
      console.error('Error syncing appointments:', error);
      alert('Failed to sync appointments');
    } finally {
      setSyncing(false);
    }
  };

  const openScheduleForm = (calendar: GHLCalendar) => {
    setSelectedCalendar(calendar);
    setShowScheduleForm(true);
    // Reset form
    setDateStart('');
    setDateEnd('');
    setSelectedOpportunity('');
    setSelectedTeamMember('');
    setInstructions('');
    setInternalNotes('');
    setShowPreview(false);
    // Reset opportunity selection
    setOpportunityTab('existing');
    setOpportunitySearchTerm('');
    setSelectedPipelineStage('');
    setContactSearchTerm('');
    setSelectedContact(null);
    setNewOpportunityTitle('');
    setSelectedPipeline('');
    setSelectedStage('');
    setNewOpportunityValue('');
  };

  // Filter opportunities based on search and pipeline stage
  const filteredOpportunities = opportunities.filter(opp => {
    const matchesSearch = !opportunitySearchTerm || 
      opp.title.toLowerCase().includes(opportunitySearchTerm.toLowerCase()) ||
      opp.contact_name.toLowerCase().includes(opportunitySearchTerm.toLowerCase());
    
    const matchesStage = !selectedPipelineStage || 
      opp.stage === selectedPipelineStage;
    
    return matchesSearch && matchesStage;
  });

  // Get unique pipeline stages from opportunities and sort them by pipeline position
  const uniqueStages = (() => {
    // Get unique stages from opportunities first
    const stages = Array.from(new Set(opportunities.map(o => o.stage).filter(Boolean)));
    
    // If pipelines haven't loaded yet, return alphabetically sorted
    if (!pipelines || pipelines.length === 0) {
      return stages.sort((a, b) => a.localeCompare(b));
    }
    
    // Create a map of stage names to their positions across all pipelines
    const stagePositionMap = new Map<string, number>();
    
    // Build position map from all pipelines
    pipelines.forEach(pipeline => {
      pipeline.stages.forEach((stage, index) => {
        // Use the minimum position if stage appears in multiple pipelines
        const currentPos = stagePositionMap.get(stage.name);
        const newPos = stage.position !== undefined ? stage.position : index;
        if (currentPos === undefined || newPos < currentPos) {
          stagePositionMap.set(stage.name, newPos);
        }
      });
    });
    
    console.log('Stage position map:', Array.from(stagePositionMap.entries()));
    console.log('Opportunity stages:', stages);
    
    // Sort by position if available, otherwise alphabetically
    return stages.sort((a, b) => {
      const posA = stagePositionMap.get(a);
      const posB = stagePositionMap.get(b);
      
      if (posA !== undefined && posB !== undefined) {
        return posA - posB;
      } else if (posA !== undefined) {
        return -1;
      } else if (posB !== undefined) {
        return 1;
      }
      return a.localeCompare(b);
    });
  })();
  

  const generatePreviewDates = () => {
    if (!dateStart || !dateEnd) return [];
    
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    const dates = eachDayOfInterval({ start, end });
    
    return dates.filter(date => includeWeekends || !isWeekend(date));
  };

  const createBulkAppointments = async () => {
    if (!selectedCalendar || !selectedOpportunity || !selectedTeamMember) {
      alert('Please select an opportunity and team member');
      return;
    }
    
    const dates = generatePreviewDates();
    if (dates.length === 0) {
      alert('No valid dates selected');
      return;
    }
    
    setCreating(true);
    try {
      const response = await fetch('/api/ghl/appointments/bulk-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: selectedCalendar.id,
          opportunityId: selectedOpportunity,
          teamMemberId: selectedTeamMember,
          dateStart,
          dateEnd,
          timeStart,
          timeEnd,
          includeWeekends,
          instructions,
          internalNotes,
          appointmentDates: dates.map(d => format(d, 'yyyy-MM-dd'))
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`Successfully created ${data.created} appointments`);
        setShowScheduleForm(false);
        await fetchAllAppointments();
      } else {
        alert(data.error || 'Failed to create appointments');
      }
    } catch (error) {
      console.error('Error creating appointments:', error);
      alert('Failed to create appointments');
    } finally {
      setCreating(false);
    }
  };

  // Get calendar days for the grid
  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  // Get appointments for a specific day
  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(apt => {
      const aptDate = parseISO(apt.start_time);
      return isSameDay(aptDate, day);
    });
  };

  const calendarDays = getCalendarDays();
  const selectedOpp = opportunities.find(o => o.opportunity_id === selectedOpportunity);
  const previewDates = generatePreviewDates();

  return (
    <div className="h-full flex">
      {/* Main Calendar Grid */}
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl font-semibold text-gray-900">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
              >
                Today
              </button>
            </div>
            
            <button
              onClick={syncAppointments}
              disabled={syncing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>Sync All</span>
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-700">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayAppointments = getAppointmentsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);
              
              return (
                <div
                  key={idx}
                  className={`
                    min-h-[120px] p-2 border-r border-b
                    ${!isCurrentMonth ? 'bg-gray-50' : 'bg-white'}
                    ${isCurrentDay ? 'bg-blue-50' : ''}
                    hover:bg-gray-50 cursor-pointer
                  `}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className={`
                    text-sm font-medium mb-1
                    ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}
                    ${isCurrentDay ? 'text-blue-600' : ''}
                  `}>
                    {format(day, 'd')}
                  </div>
                  
                  {/* Appointments */}
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 3).map((apt, i) => (
                      <div
                        key={i}
                        className="text-xs p-1 bg-blue-100 text-blue-800 rounded truncate"
                        title={`${apt.title} - ${apt.opportunity?.contact_name || 'No contact'}`}
                      >
                        <div className="font-medium truncate">
                          {format(parseISO(apt.start_time), 'h:mm a')}
                        </div>
                        <div className="truncate">
                          {apt.opportunity?.contact_name || apt.title}
                        </div>
                      </div>
                    ))}
                    {dayAppointments.length > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{dayAppointments.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details */}
        {selectedDate && (
          <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            <div className="space-y-2">
              {getAppointmentsForDay(selectedDate).length === 0 ? (
                <p className="text-gray-500">No appointments scheduled</p>
              ) : (
                getAppointmentsForDay(selectedDate).map(apt => (
                  <div key={apt.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">
                        {format(parseISO(apt.start_time), 'h:mm a')} - {format(parseISO(apt.end_time), 'h:mm a')}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        apt.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        apt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      {apt.opportunity?.contact_name && (
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2" />
                          {apt.opportunity.contact_name}
                        </div>
                      )}
                      {apt.team_member && (
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2" />
                          Assigned to: {apt.team_member.full_name}
                        </div>
                      )}
                      {apt.description && (
                        <div className="flex items-start">
                          <FileText className="w-4 h-4 mr-2 mt-0.5" />
                          <span className="text-xs">{apt.description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Calendar List */}
      <div className="w-80 bg-gray-50 border-l border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <CalendarDays className="w-5 h-5 mr-2" />
          Available Calendars
        </h3>
        
        {calendars.length === 0 ? (
          <p className="text-sm text-gray-500">No calendars found. Please sync with GoHighLevel.</p>
        ) : (
          <div className="space-y-3">
            {calendars.map(calendar => {
              // Clean up HTML from description
              const cleanDescription = calendar.description
                ? calendar.description.replace(/<[^>]*>/g, '').substring(0, 100)
                : '';
              
              return (
                <div
                  key={calendar.id}
                  className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm flex items-center">
                        <Plus className="w-3.5 h-3.5 mr-1 text-green-600" />
                        {calendar.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5 ml-4.5">
                        {appointments.filter(a => a.calendar_id === calendar.id).length} appointments
                      </p>
                    </div>
                    
                    <button
                      onClick={() => openScheduleForm(calendar)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Schedule</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Form Modal/Slide-over */}
      {showScheduleForm && selectedCalendar && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowScheduleForm(false)} />
          
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-xl">
            <div className="h-full flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Schedule Visits</h2>
                    <p className="text-sm text-gray-600 mt-1">Calendar: {selectedCalendar.name}</p>
                  </div>
                  <button
                    onClick={() => setShowScheduleForm(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* Enhanced Opportunity Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select or Create Opportunity
                    </label>
                    
                    {/* Tabs */}
                    <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-4">
                      <button
                        type="button"
                        onClick={() => setOpportunityTab('existing')}
                        className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                          opportunityTab === 'existing'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Select Existing
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpportunityTab('new')}
                        className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                          opportunityTab === 'new'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Create New
                      </button>
                    </div>

                    {/* Existing Opportunity Tab */}
                    {opportunityTab === 'existing' && (
                      <div className="space-y-3">
                        {/* Search Input */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search opportunities..."
                            value={opportunitySearchTerm}
                            onChange={(e) => setOpportunitySearchTerm(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Pipeline Stage Filter */}
                        <div className="relative">
                          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <select
                            value={selectedPipelineStage}
                            onChange={(e) => setSelectedPipelineStage(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
                          >
                            <option value="">All Pipeline Stages</option>
                            {uniqueStages.map(stage => (
                              <option key={stage} value={stage}>{stage}</option>
                            ))}
                          </select>
                        </div>

                        {/* Results List */}
                        <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                          {filteredOpportunities.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                              No opportunities found
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-200">
                              {filteredOpportunities.map(opp => (
                                <label
                                  key={opp.opportunity_id}
                                  className={`block p-3 hover:bg-gray-50 cursor-pointer ${
                                    selectedOpportunity === opp.opportunity_id ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="opportunity"
                                    value={opp.opportunity_id}
                                    checked={selectedOpportunity === opp.opportunity_id}
                                    onChange={(e) => setSelectedOpportunity(e.target.value)}
                                    className="sr-only"
                                  />
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-gray-900">{opp.title}</p>
                                      <p className="text-sm text-gray-600">
                                        {opp.contact_name} 
                                        {opp.stage && <span className="ml-2">• {opp.stage}</span>}
                                      </p>
                                    </div>
                                    {opp.monetary_value && (
                                      <div className="flex items-center text-sm text-gray-600">
                                        <DollarSign className="w-3 h-3 mr-1" />
                                        {opp.monetary_value.toLocaleString()}
                                      </div>
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Selected Opportunity Info */}
                        {selectedOpp && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-900">
                              Selected: <span className="font-medium">{selectedOpp.title}</span>
                            </p>
                            <p className="text-sm text-blue-700 mt-1">
                              Customer: {selectedOpp.contact_name}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Create New Opportunity Tab */}
                    {opportunityTab === 'new' && (
                      <div className="space-y-3">
                        {/* Contact Search */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Search Contact
                          </label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search by name, email, or phone..."
                              value={contactSearchTerm}
                              onChange={(e) => setContactSearchTerm(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          
                          {/* Contact Results */}
                          {contacts.length > 0 && (
                            <div className="mt-2 border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                              {contacts.map(contact => (
                                <button
                                  key={contact.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedContact(contact);
                                    setContactSearchTerm(contact.name);
                                    setContacts([]);
                                  }}
                                  className="w-full text-left p-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                                >
                                  <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                                  <p className="text-xs text-gray-600">
                                    {contact.email} {contact.phone && `• ${contact.phone}`}
                                  </p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Selected Contact Display */}
                        {selectedContact && (
                          <div className="p-2 bg-green-50 rounded-lg">
                            <p className="text-xs text-green-900">
                              Contact: <span className="font-medium">{selectedContact.name}</span>
                            </p>
                            {selectedContact.email && (
                              <p className="text-xs text-green-700">{selectedContact.email}</p>
                            )}
                          </div>
                        )}

                        {/* Opportunity Title */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Opportunity Title
                          </label>
                          <input
                            type="text"
                            placeholder="Enter opportunity name..."
                            value={newOpportunityTitle}
                            onChange={(e) => setNewOpportunityTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Pipeline Selection */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Pipeline
                            </label>
                            <select
                              value={selectedPipeline}
                              onChange={(e) => {
                                setSelectedPipeline(e.target.value);
                                setSelectedStage('');
                              }}
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                            >
                              <option value="">Select pipeline...</option>
                              {pipelines.map(pipeline => (
                                <option key={pipeline.id} value={pipeline.id}>
                                  {pipeline.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Stage
                            </label>
                            <select
                              value={selectedStage}
                              onChange={(e) => setSelectedStage(e.target.value)}
                              disabled={!selectedPipeline}
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
                            >
                              <option value="">Select stage...</option>
                              {selectedPipeline && 
                                pipelines
                                  .find(p => p.id === selectedPipeline)
                                  ?.stages.map(stage => (
                                    <option key={stage.id} value={stage.id}>
                                      {stage.name}
                                    </option>
                                  ))
                              }
                            </select>
                          </div>
                        </div>

                        {/* Monetary Value */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Value (Optional)
                          </label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newOpportunityValue}
                              onChange={(e) => setNewOpportunityValue(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        {/* Create Button */}
                        <button
                          type="button"
                          onClick={async () => {
                            if (!selectedContact || !newOpportunityTitle || !selectedPipeline || !selectedStage) {
                              alert('Please fill in all required fields');
                              return;
                            }

                            try {
                              const response = await fetch('/api/ghl/opportunities/create', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  contactId: selectedContact.id,
                                  pipelineId: selectedPipeline,
                                  stageId: selectedStage,
                                  name: newOpportunityTitle,
                                  value: newOpportunityValue,
                                }),
                              });

                              if (!response.ok) {
                                const error = await response.json();
                                throw new Error(error.error || 'Failed to create opportunity');
                              }

                              const data = await response.json();
                              
                              // Add the new opportunity to the selected list
                              setSelectedOpportunity(data.opportunity.id);
                              
                              // Fetch opportunities again to include the new one
                              const oppsResponse = await fetch('/api/ghl/opportunities');
                              if (oppsResponse.ok) {
                                const oppsData = await oppsResponse.json();
                                setOpportunities(oppsData.opportunities || []);
                              }

                              // Reset form and switch back to existing tab
                              setContactSearch('');
                              setSelectedContact(null);
                              setNewOpportunityTitle('');
                              setSelectedPipeline('');
                              setSelectedStage('');
                              setNewOpportunityValue('');
                              setOpportunityTab('existing');
                              
                              alert('Opportunity created successfully!');
                            } catch (error: any) {
                              console.error('Error creating opportunity:', error);
                              alert(error.message || 'Failed to create opportunity');
                            }
                          }}
                          disabled={!selectedContact || !newOpportunityTitle || !selectedPipeline || !selectedStage}
                          className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          Create Opportunity & Select
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Team Member Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign To Team Member
                    </label>
                    <select
                      value={selectedTeamMember}
                      onChange={(e) => setSelectedTeamMember(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose team member...</option>
                      {(() => {
                        // Filter team members based on selected calendar
                        const filteredMembers = selectedCalendar?.teamMembers && selectedCalendar.teamMembers.length > 0
                          ? teamMembers.filter(member => {
                              const memberId = member.external_id || member.ghl_user_id || '';
                              return selectedCalendar.teamMembers?.includes(memberId);
                            })
                          : teamMembers; // Show all if calendar has no specific team members assigned
                        
                        console.log('Calendar team members:', selectedCalendar?.teamMembers);
                        console.log('Filtered members:', filteredMembers);
                        
                        if (filteredMembers.length === 0) {
                          return <option disabled>No team members assigned to this calendar</option>;
                        }
                        
                        return filteredMembers.map(member => (
                          <option key={member.id} value={member.id}>
                            {member.full_name} ({member.email})
                          </option>
                        ));
                      })()}
                    </select>
                    {teamMembers.length === 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        Team members are being synced from your GoHighLevel account
                      </p>
                    )}
                    {selectedCalendar?.teamMembers && selectedCalendar.teamMembers.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        Showing team members assigned to this calendar
                      </p>
                    )}
                  </div>

                  {/* Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={dateStart}
                        onChange={(e) => setDateStart(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                        min={dateStart}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Time Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                        min={timeStart}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Weekend Toggle */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="includeWeekends"
                      checked={includeWeekends}
                      onChange={(e) => setIncludeWeekends(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="includeWeekends" className="ml-2 text-sm text-gray-700">
                      Include weekends
                    </label>
                  </div>

                  {/* Instructions and Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instructions (visible to customer)
                    </label>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter any instructions for the appointment..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Internal Notes (team only)
                    </label>
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter internal notes..."
                    />
                  </div>

                  {/* Preview */}
                  {dateStart && dateEnd && (
                    <div>
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {showPreview ? 'Hide' : 'Show'} Preview ({previewDates.length} appointments)
                      </button>
                      
                      {showPreview && previewDates.length > 0 && (
                        <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">Appointments to be created:</h4>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {previewDates.map((date, idx) => (
                              <div key={idx} className="text-sm text-gray-600 flex items-center">
                                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                                {format(date, 'EEE, MMM d, yyyy')} at {timeStart} - {timeEnd}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowScheduleForm(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createBulkAppointments}
                    disabled={creating || !selectedOpportunity || !selectedTeamMember || previewDates.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Creating...' : `Create ${previewDates.length} Appointments`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}