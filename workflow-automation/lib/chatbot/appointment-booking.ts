import { createGHLMCPClient } from '@/lib/mcp/ghl-mcp-client';
import { getServiceSupabase } from '@/lib/supabase/client';
import { AIReasoningEngine } from './reasoning-engine';
import { parse, format, addMinutes, isValid } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

interface AppointmentBookingParams {
  sessionId: string;
  nodeId: string;
  contactId: string;
  calendarIds: string[];
  userMessage: string;
  conversationHistory: Message[];
  timezone?: string;
}

interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

interface BookingResult {
  success: boolean;
  appointmentId?: string;
  confirmedTime?: Date;
  message: string;
  suggestedTimes?: Date[];
  status: 'pending' | 'proposed' | 'confirmed' | 'failed';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CalendarInfo {
  id: string;
  name: string;
  description?: string;
  timezone?: string;
  workingHours?: any;
}

export class AppointmentBookingModule {
  private supabase = getServiceSupabase();
  private reasoningEngine: AIReasoningEngine;
  
  constructor(openAIKey: string) {
    this.reasoningEngine = new AIReasoningEngine(openAIKey);
  }

  /**
   * Main method to handle appointment booking conversation
   */
  async processBookingRequest(
    params: AppointmentBookingParams,
    mcpClient: any
  ): Promise<BookingResult> {
    try {
      // Check if we have an active booking session
      const { data: existingBooking } = await this.supabase
        .from('appointment_bookings')
        .select('*')
        .eq('session_id', params.sessionId)
        .eq('node_id', params.nodeId)
        .eq('status', 'proposed')
        .single();

      if (existingBooking) {
        // User is responding to proposed times
        return await this.handleTimeSelection(
          existingBooking,
          params.userMessage,
          params.conversationHistory,
          mcpClient
        );
      } else {
        // New booking request - extract intent and preferences
        return await this.initiateBooking(params, mcpClient);
      }
    } catch (error) {
      console.error('Error in appointment booking:', error);
      return {
        success: false,
        message: 'I encountered an error while trying to book your appointment. Please try again.',
        status: 'failed'
      };
    }
  }

  /**
   * Start a new booking process
   */
  private async initiateBooking(
    params: AppointmentBookingParams,
    mcpClient: any
  ): Promise<BookingResult> {
    try {
      // Extract booking preferences from user message
      const preferences = await this.extractBookingPreferences(
        params.userMessage,
        params.conversationHistory
      );

      // Get calendar information
      const calendars = await this.getCalendarInfo(params.calendarIds, mcpClient);
      
      // Select the most appropriate calendar
      const selectedCalendar = await this.selectBestCalendar(
        calendars,
        preferences,
        params.userMessage
      );

      if (!selectedCalendar) {
        return {
          success: false,
          message: 'I couldn\'t find an appropriate calendar for your request. Could you please specify which service you need?',
          status: 'failed'
        };
      }

      // Get available time slots
      const availableSlots = await this.getAvailableSlots(
        selectedCalendar.id,
        preferences,
        mcpClient
      );

      if (availableSlots.length === 0) {
        return {
          success: false,
          message: 'I couldn\'t find any available time slots that match your preferences. Would you like to try different dates or times?',
          status: 'failed'
        };
      }

      // Propose times to the user
      const proposedTimes = this.selectBestTimeSlots(availableSlots, preferences, 3);
      
      // Save booking session
      await this.saveBookingSession(
        params.sessionId,
        params.nodeId,
        params.contactId,
        selectedCalendar.id,
        proposedTimes,
        preferences
      );

      // Generate response with proposed times
      const message = this.formatProposedTimesMessage(proposedTimes, selectedCalendar);

      return {
        success: true,
        message,
        suggestedTimes: proposedTimes,
        status: 'proposed'
      };

    } catch (error) {
      console.error('Error initiating booking:', error);
      return {
        success: false,
        message: 'I had trouble accessing the calendar system. Please try again in a moment.',
        status: 'failed'
      };
    }
  }

  /**
   * Handle user's response to proposed times
   */
  private async handleTimeSelection(
    booking: any,
    userMessage: string,
    conversationHistory: Message[],
    mcpClient: any
  ): Promise<BookingResult> {
    try {
      // Determine which time slot the user selected
      const selectedTime = await this.extractSelectedTime(
        userMessage,
        booking.proposed_times,
        conversationHistory
      );

      if (!selectedTime) {
        // User didn't select a proposed time, check if they're suggesting a new time
        const newTimeRequest = await this.extractBookingPreferences(
          userMessage,
          conversationHistory
        );

        if (newTimeRequest.dateTime || newTimeRequest.dateRange) {
          // User is requesting different times
          return await this.initiateBooking(
            {
              sessionId: booking.session_id,
              nodeId: booking.node_id,
              contactId: booking.contact_id,
              calendarIds: [booking.calendar_id],
              userMessage,
              conversationHistory
            },
            mcpClient
          );
        }

        return {
          success: false,
          message: 'I didn\'t understand which time you\'d prefer. Could you please specify which option works best for you, or suggest a different time?',
          status: 'proposed'
        };
      }

      // Book the appointment
      const appointmentResult = await this.bookAppointment(
        booking.calendar_id,
        booking.contact_id,
        selectedTime,
        booking.booking_data,
        mcpClient
      );

      if (appointmentResult.success) {
        // Update booking status
        await this.supabase
          .from('appointment_bookings')
          .update({
            status: 'confirmed',
            appointment_id: appointmentResult.appointmentId,
            selected_time: selectedTime.toISOString()
          })
          .eq('id', booking.id);

        return {
          success: true,
          appointmentId: appointmentResult.appointmentId,
          confirmedTime: selectedTime,
          message: appointmentResult.message,
          status: 'confirmed'
        };
      } else {
        return {
          success: false,
          message: appointmentResult.message,
          status: 'failed'
        };
      }

    } catch (error) {
      console.error('Error handling time selection:', error);
      return {
        success: false,
        message: 'I encountered an error while booking your appointment. Please try again.',
        status: 'failed'
      };
    }
  }

  /**
   * Extract booking preferences from natural language
   */
  private async extractBookingPreferences(
    userMessage: string,
    conversationHistory: Message[]
  ): Promise<any> {
    const schema = {
      dateTime: 'ISO datetime if specific time mentioned',
      dateRange: {
        start: 'ISO date',
        end: 'ISO date'
      },
      timePreferences: {
        morning: 'boolean',
        afternoon: 'boolean',
        evening: 'boolean',
        specificTimes: 'array of time strings'
      },
      dayPreferences: {
        weekdays: 'boolean',
        weekends: 'boolean',
        specificDays: 'array of day names'
      },
      duration: 'number of minutes',
      urgency: 'low | medium | high',
      serviceType: 'string describing what they need',
      additionalNotes: 'string'
    };

    const extractedData = await this.reasoningEngine.extractData(
      userMessage,
      schema,
      conversationHistory
    );

    // Post-process extracted data
    return this.normalizeBookingPreferences(extractedData);
  }

  /**
   * Get calendar information from GoHighLevel
   */
  private async getCalendarInfo(
    calendarIds: string[],
    mcpClient: any
  ): Promise<CalendarInfo[]> {
    try {
      // For now, return mock calendar info
      // In production, this would fetch actual calendar details from GHL
      return calendarIds.map(id => ({
        id,
        name: `Calendar ${id}`,
        timezone: 'America/New_York',
        workingHours: {
          monday: { start: '09:00', end: '17:00' },
          tuesday: { start: '09:00', end: '17:00' },
          wednesday: { start: '09:00', end: '17:00' },
          thursday: { start: '09:00', end: '17:00' },
          friday: { start: '09:00', end: '17:00' }
        }
      }));
    } catch (error) {
      console.error('Error fetching calendar info:', error);
      return [];
    }
  }

  /**
   * Select the most appropriate calendar based on user request
   */
  private async selectBestCalendar(
    calendars: CalendarInfo[],
    preferences: any,
    userMessage: string
  ): Promise<CalendarInfo | null> {
    if (calendars.length === 0) return null;
    if (calendars.length === 1) return calendars[0];

    // Use AI to match service type with calendar names
    try {
      const systemPrompt = `Match the user's service request with the most appropriate calendar.
User request: "${userMessage}"
Service type: ${preferences.serviceType || 'general'}

Available calendars:
${calendars.map((c, i) => `${i + 1}. ${c.name} - ${c.description || 'No description'}`).join('\n')}

Return only the number of the best matching calendar.`;

      const completion = await this.reasoningEngine['openai'].chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0,
        max_tokens: 10
      });

      const selection = parseInt(completion.choices[0].message.content || '1') - 1;
      return calendars[selection] || calendars[0];

    } catch (error) {
      console.error('Error selecting calendar:', error);
      return calendars[0];
    }
  }

  /**
   * Get available time slots from calendar
   */
  private async getAvailableSlots(
    calendarId: string,
    preferences: any,
    mcpClient: any
  ): Promise<TimeSlot[]> {
    // This is a simplified implementation
    // In production, this would query actual calendar availability
    const slots: TimeSlot[] = [];
    const now = new Date();
    const startDate = preferences.dateTime ? new Date(preferences.dateTime) : now;
    
    // Generate some sample available slots
    for (let i = 1; i <= 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Morning slot
      if (preferences.timePreferences?.morning !== false) {
        const morning = new Date(date);
        morning.setHours(9, 0, 0, 0);
        slots.push({
          start: morning,
          end: addMinutes(morning, preferences.duration || 30),
          available: true
        });
      }
      
      // Afternoon slot
      if (preferences.timePreferences?.afternoon !== false) {
        const afternoon = new Date(date);
        afternoon.setHours(14, 0, 0, 0);
        slots.push({
          start: afternoon,
          end: addMinutes(afternoon, preferences.duration || 30),
          available: true
        });
      }
    }
    
    return slots;
  }

  /**
   * Select the best time slots to propose
   */
  private selectBestTimeSlots(
    availableSlots: TimeSlot[],
    preferences: any,
    count: number = 3
  ): Date[] {
    // Sort slots by preference matching and select top N
    const scoredSlots = availableSlots.map(slot => {
      let score = 0;
      
      // Prefer sooner appointments for high urgency
      if (preferences.urgency === 'high') {
        score += 10 / (slot.start.getTime() - Date.now());
      }
      
      // Match time preferences
      const hour = slot.start.getHours();
      if (hour < 12 && preferences.timePreferences?.morning) score += 5;
      if (hour >= 12 && hour < 17 && preferences.timePreferences?.afternoon) score += 5;
      if (hour >= 17 && preferences.timePreferences?.evening) score += 5;
      
      return { slot, score };
    });
    
    scoredSlots.sort((a, b) => b.score - a.score);
    
    return scoredSlots
      .slice(0, count)
      .map(item => item.slot.start);
  }

  /**
   * Format proposed times into a user-friendly message
   */
  private formatProposedTimesMessage(times: Date[], calendar: CalendarInfo): string {
    const timeOptions = times.map((time, index) => {
      const formatted = format(time, 'EEEE, MMMM d at h:mm a');
      return `${index + 1}. ${formatted}`;
    }).join('\n');
    
    return `I have the following times available for your appointment:\n\n${timeOptions}\n\nWhich time works best for you? You can reply with the number or suggest a different time.`;
  }

  /**
   * Extract which time the user selected from proposed options
   */
  private async extractSelectedTime(
    userMessage: string,
    proposedTimes: string[],
    conversationHistory: Message[]
  ): Promise<Date | null> {
    try {
      // Check for number selection (1, 2, 3, etc.)
      const numberMatch = userMessage.match(/\b([1-9])\b/);
      if (numberMatch) {
        const index = parseInt(numberMatch[1]) - 1;
        if (index >= 0 && index < proposedTimes.length) {
          return new Date(proposedTimes[index]);
        }
      }
      
      // Use AI to match natural language to proposed times
      const systemPrompt = `The user was offered these appointment times:
${proposedTimes.map((t, i) => `${i + 1}. ${format(new Date(t), 'EEEE, MMMM d at h:mm a')}`).join('\n')}

Based on their response: "${userMessage}"
Which time did they select? Return only the number (1, 2, 3, etc.) or "none" if they didn't select any.`;

      const completion = await this.reasoningEngine['openai'].chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0,
        max_tokens: 10
      });
      
      const response = completion.choices[0].message.content?.trim();
      if (response && response !== 'none') {
        const index = parseInt(response) - 1;
        if (index >= 0 && index < proposedTimes.length) {
          return new Date(proposedTimes[index]);
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('Error extracting selected time:', error);
      return null;
    }
  }

  /**
   * Book the actual appointment in GoHighLevel
   */
  private async bookAppointment(
    calendarId: string,
    contactId: string,
    selectedTime: Date,
    bookingData: any,
    mcpClient: any
  ): Promise<{ success: boolean; appointmentId?: string; message: string }> {
    try {
      // This would use the GHL MCP client to create the appointment
      // For now, we'll simulate the booking
      
      const appointmentId = `apt_${Date.now()}`;
      
      // In production, this would call:
      // const result = await mcpClient.createAppointment({
      //   calendarId,
      //   contactId,
      //   startTime: selectedTime.toISOString(),
      //   ...bookingData
      // });
      
      const formattedTime = format(selectedTime, 'EEEE, MMMM d at h:mm a');
      
      return {
        success: true,
        appointmentId,
        message: `Perfect! I've booked your appointment for ${formattedTime}. You'll receive a confirmation email shortly with all the details.`
      };
      
    } catch (error) {
      console.error('Error booking appointment:', error);
      return {
        success: false,
        message: 'I encountered an error while booking your appointment. Please contact support for assistance.'
      };
    }
  }

  /**
   * Save booking session to database
   */
  private async saveBookingSession(
    sessionId: string,
    nodeId: string,
    contactId: string,
    calendarId: string,
    proposedTimes: Date[],
    preferences: any
  ): Promise<void> {
    await this.supabase
      .from('appointment_bookings')
      .insert([{
        session_id: sessionId,
        node_id: nodeId,
        calendar_id: calendarId,
        contact_id: contactId,
        proposed_times: proposedTimes.map(t => t.toISOString()),
        status: 'proposed',
        booking_data: preferences
      }]);
  }

  /**
   * Normalize extracted booking preferences
   */
  private normalizeBookingPreferences(rawData: any): any {
    const normalized: any = {
      timePreferences: {},
      dayPreferences: {},
      urgency: 'medium'
    };
    
    // Copy over direct fields
    if (rawData.dateTime) normalized.dateTime = rawData.dateTime;
    if (rawData.dateRange) normalized.dateRange = rawData.dateRange;
    if (rawData.duration) normalized.duration = rawData.duration;
    if (rawData.serviceType) normalized.serviceType = rawData.serviceType;
    if (rawData.additionalNotes) normalized.additionalNotes = rawData.additionalNotes;
    
    // Normalize time preferences
    if (rawData.timePreferences) {
      normalized.timePreferences = {
        morning: rawData.timePreferences.morning === true,
        afternoon: rawData.timePreferences.afternoon === true,
        evening: rawData.timePreferences.evening === true,
        specificTimes: Array.isArray(rawData.timePreferences.specificTimes) 
          ? rawData.timePreferences.specificTimes 
          : []
      };
    }
    
    // Normalize day preferences
    if (rawData.dayPreferences) {
      normalized.dayPreferences = {
        weekdays: rawData.dayPreferences.weekdays !== false,
        weekends: rawData.dayPreferences.weekends === true,
        specificDays: Array.isArray(rawData.dayPreferences.specificDays)
          ? rawData.dayPreferences.specificDays
          : []
      };
    }
    
    // Normalize urgency
    if (['low', 'medium', 'high'].includes(rawData.urgency)) {
      normalized.urgency = rawData.urgency;
    }
    
    return normalized;
  }
}