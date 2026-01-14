'use client';

import { useState, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, View, ToolbarProps, Navigate } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, setMonth, setYear } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Cast to any to avoid strict typing issues
const DnDCalendar = withDragAndDrop(Calendar as any) as any;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 5; y++) {
    years.push(y);
  }
  return years;
}

type NavigateAction = 'PREV' | 'NEXT' | 'TODAY' | 'DATE';

interface CustomToolbarProps extends ToolbarProps {
  onCustomNavigate: (action: NavigateAction, newDate?: Date) => void;
}

function CustomToolbar({ date, view, onNavigate, onView, onCustomNavigate }: CustomToolbarProps) {
  const currentMonth = date.getMonth();
  const currentYear = date.getFullYear();
  const years = getYearOptions();

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10);
    const newDate = setMonth(date, newMonth);
    onCustomNavigate('DATE', newDate);
    onNavigate(Navigate.DATE, newDate);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    const newDate = setYear(date, newYear);
    onCustomNavigate('DATE', newDate);
    onNavigate(Navigate.DATE, newDate);
  };

  return (
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate(Navigate.TODAY)}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Today
        </button>
        <button
          onClick={() => onNavigate(Navigate.PREVIOUS)}
          className="p-1.5 hover:bg-gray-100 rounded-md"
        >
          ←
        </button>
        <button
          onClick={() => onNavigate(Navigate.NEXT)}
          className="p-1.5 hover:bg-gray-100 rounded-md"
        >
          →
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={currentMonth}
          onChange={handleMonthChange}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        >
          {MONTHS.map((month, idx) => (
            <option key={month} value={idx}>{month}</option>
          ))}
        </select>
        <select
          value={currentYear}
          onChange={handleYearChange}
          className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
        <button
          onClick={() => onView('month')}
          className={`px-3 py-1.5 text-sm rounded-md ${view === 'month' ? 'bg-white shadow-sm' : ''}`}
        >
          Month
        </button>
        <button
          onClick={() => onView('week')}
          className={`px-3 py-1.5 text-sm rounded-md ${view === 'week' ? 'bg-white shadow-sm' : ''}`}
        >
          Week
        </button>
        <button
          onClick={() => onView('agenda')}
          className={`px-3 py-1.5 text-sm rounded-md ${view === 'agenda' ? 'bg-white shadow-sm' : ''}`}
        >
          Agenda
        </button>
      </div>
    </div>
  );
}

interface CalendarViewProps {
  tasks: any[];
  onEventClick: (task: any) => void;
  onEventDrop?: (args: { event: any; start: Date; end: Date }) => void;
}

export default function CalendarView({ tasks, onEventClick, onEventDrop }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('month');

  const events = tasks.map(t => ({
    id: t.id,
    title: t.title,
    start: new Date(t.startDate || t.start_date || new Date()),
    end: new Date(t.dueDate || t.due_date || new Date()),
    allDay: true,
    resource: t
  }));

  const handleCustomNavigate = useCallback((action: NavigateAction, newDate?: Date) => {
    if (action === 'DATE' && newDate) {
      setCurrentDate(newDate);
    }
  }, []);

  const eventStyleGetter = (event: any) => {
    const status = event.resource?.status;
    let backgroundColor = '#f97316'; // orange-500

    if (status === 'DONE' || status === 'COMPLETED') {
      backgroundColor = '#22c55e'; // green-500
    } else if (status === 'IN_PROGRESS') {
      backgroundColor = '#3b82f6'; // blue-500
    } else if (event.resource?.priority === 'HIGH') {
      backgroundColor = '#a855f7'; // purple-500
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  return (
    <div className="h-full min-h-[600px]">
      <DnDCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        date={currentDate}
        view={currentView}
        onNavigate={(newDate: Date) => setCurrentDate(newDate)}
        onView={(newView: View) => setCurrentView(newView)}
        onSelectEvent={(e: any) => onEventClick(e.resource)}
        onEventDrop={onEventDrop ? (args: any) => onEventDrop({
          event: args.event,
          start: args.start,
          end: args.end
        }) : undefined}
        resizable={false}
        draggableAccessor={() => !!onEventDrop}
        views={['month', 'week', 'agenda']}
        eventPropGetter={eventStyleGetter}
        components={{
          toolbar: (props: ToolbarProps) => (
            <CustomToolbar
              {...props}
              onCustomNavigate={handleCustomNavigate}
            />
          )
        }}
      />
    </div>
  );
}
