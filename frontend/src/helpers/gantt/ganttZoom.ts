import dayjs from 'dayjs'

export type GanttZoomLevel = 'day' | 'week' | 'biweek' | 'month'

export interface GanttZoomRange {
	start: Date
	end: Date
	days: number
}

const MIN_DAY_WIDTH_PIXELS: Record<GanttZoomLevel, number> = {
	day: 30,
	week: 10,
	biweek: 6,
	month: 3,
}

export function getMinDayWidthPixels(zoom: GanttZoomLevel): number {
	return MIN_DAY_WIDTH_PIXELS[zoom]
}

const EXTEND_CHUNK_DAYS: Record<GanttZoomLevel, number> = {
	day: 14,
	week: 28,
	biweek: 56,
	month: 90,
}

/**
 * How many days to grow the selected date range by per "extend" action (edge button or
 * scroll-to-edge), scaled to the zoom level so the jump feels proportional to how much
 * time is already visible per screen at that zoom.
 */
export function getExtendChunkDays(zoom: GanttZoomLevel): number {
	return EXTEND_CHUNK_DAYS[zoom]
}

function naturalUnitStart(date: dayjs.Dayjs, zoom: GanttZoomLevel): dayjs.Dayjs {
	if (zoom === 'week') {
		return date.startOf('week')
	}
	if (zoom === 'month') {
		return date.startOf('month')
	}
	return date.startOf('day')
}

function nextUnitStart(date: dayjs.Dayjs, zoom: GanttZoomLevel): dayjs.Dayjs {
	if (zoom === 'week') {
		return date.add(7, 'day')
	}
	if (zoom === 'biweek') {
		return date.add(14, 'day')
	}
	if (zoom === 'month') {
		return date.add(1, 'month')
	}
	return date.add(1, 'day')
}

/**
 * Visible timeline buckets for the given zoom level, clamped to [dateFrom, dateTo].
 * Week/month buckets are anchored to their real calendar boundaries (so the first/last
 * bucket can be partial), biweek buckets are anchored to dateFrom since there's no
 * calendar concept of a "biweek".
 */
export function getZoomUnitRanges(dateFrom: Date, dateTo: Date, zoom: GanttZoomLevel): GanttZoomRange[] {
	const from = dayjs(dateFrom).startOf('day')
	const toExclusive = dayjs(dateTo).startOf('day').add(1, 'day')

	const ranges: GanttZoomRange[] = []
	let unitStart = zoom === 'biweek' ? from : naturalUnitStart(from, zoom)

	while (unitStart.isBefore(toExclusive)) {
		const unitEnd = nextUnitStart(unitStart, zoom)
		const rangeStart = unitStart.isBefore(from) ? from : unitStart
		const rangeEnd = unitEnd.isAfter(toExclusive) ? toExclusive : unitEnd
		const days = Math.round(rangeEnd.diff(rangeStart, 'day', true))

		if (days > 0) {
			ranges.push({start: rangeStart.toDate(), end: rangeEnd.toDate(), days})
		}

		unitStart = unitEnd
	}

	return ranges
}

export function formatZoomUnitLabel(range: GanttZoomRange, zoom: GanttZoomLevel): string {
	if (zoom === 'month') {
		return dayjs(range.start).format('MMMM YYYY')
	}

	if (zoom === 'week' || zoom === 'biweek') {
		const lastDay = dayjs(range.end).subtract(1, 'day')
		return `${dayjs(range.start).format('MMM D')} – ${lastDay.format('MMM D')}`
	}

	return dayjs(range.start).format('MMM D')
}

const ZOOM_STEP_DAYS: Record<'day' | 'week' | 'biweek', number> = {
	day: 1,
	week: 7,
	biweek: 14,
}

/**
 * Moves a date by one zoom unit in the given direction, e.g. for keyboard-driven
 * bar move/resize. Month steps use dayjs' calendar month arithmetic so they land
 * on the same day-of-month (clamped) rather than a fixed 30-day jump.
 */
export function stepZoomUnit(date: Date, direction: 1 | -1, zoom: GanttZoomLevel): Date {
	if (zoom === 'month') {
		return dayjs(date).add(direction, 'month').toDate()
	}

	return dayjs(date).add(direction * ZOOM_STEP_DAYS[zoom], 'day').toDate()
}

const AVERAGE_DAYS_PER_MONTH = 30.4368

/**
 * Snaps a raw (fractional) day offset from a drag/resize gesture to the active zoom's
 * unit, anchored on the bar edge being moved. Month snapping goes through dayjs'
 * calendar month arithmetic so a move is always whole calendar months regardless of
 * month length, expressed back as a day count so callers keep using the existing
 * day-offset math untouched.
 */
export function snapDragDays(zoom: GanttZoomLevel, originalDate: Date, rawDays: number): number {
	if (zoom === 'month') {
		const months = Math.round(rawDays / AVERAGE_DAYS_PER_MONTH)
		if (months === 0) {
			return 0
		}
		return dayjs(originalDate).add(months, 'month').diff(dayjs(originalDate), 'day')
	}

	const step = ZOOM_STEP_DAYS[zoom]
	return Math.round(rawDays / step) * step
}
