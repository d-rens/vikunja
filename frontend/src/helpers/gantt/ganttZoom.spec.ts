import {describe, it, expect} from 'vitest'
import dayjs from 'dayjs'

import {getZoomUnitRanges, formatZoomUnitLabel, snapDragDays, getMinDayWidthPixels, stepZoomUnit} from './ganttZoom'

describe('getZoomUnitRanges', () => {
	it('returns one range per day for day zoom', () => {
		const ranges = getZoomUnitRanges(new Date('2026-08-18'), new Date('2026-08-20'), 'day')
		expect(ranges).toHaveLength(3)
		expect(ranges.every(r => r.days === 1)).toBe(true)
	})

	it('anchors week zoom to the locale week start, clamped to the range', () => {
		dayjs.locale('en')
		// 2026-08-18 is a Tuesday; en week starts Sunday, so the first bucket is Sun-Tue clipped to the range.
		const ranges = getZoomUnitRanges(new Date('2026-08-18'), new Date('2026-08-31'), 'week')
		const totalDays = ranges.reduce((sum, r) => sum + r.days, 0)
		expect(totalDays).toBe(14)
		expect(ranges[0].days).toBeLessThanOrEqual(7)
	})

	it('anchors biweek zoom to dateFrom with fixed 14-day buckets', () => {
		const ranges = getZoomUnitRanges(new Date('2026-08-18'), new Date('2026-09-14'), 'biweek')
		expect(ranges[0].days).toBe(14)
		expect(ranges[0].start).toEqual(dayjs('2026-08-18').startOf('day').toDate())
	})

	it('produces variable-width buckets per calendar month', () => {
		const ranges = getZoomUnitRanges(new Date('2026-01-15'), new Date('2026-03-15'), 'month')
		// Jan (partial), Feb (full), Mar (partial)
		expect(ranges).toHaveLength(3)
		expect(ranges[1].days).toBe(28) // Feb 2026 is not a leap year
	})

	it('covers the full range with no gaps or overlaps', () => {
		const dateFrom = new Date('2026-08-18')
		const dateTo = new Date('2026-11-02')
		for (const zoom of ['day', 'week', 'biweek', 'month'] as const) {
			const ranges = getZoomUnitRanges(dateFrom, dateTo, zoom)
			const totalDays = ranges.reduce((sum, r) => sum + r.days, 0)
			const expectedDays = dayjs(dateTo).startOf('day').diff(dayjs(dateFrom).startOf('day'), 'day') + 1
			expect(totalDays).toBe(expectedDays)
			for (let i = 1; i < ranges.length; i++) {
				expect(ranges[i].start).toEqual(ranges[i - 1].end)
			}
		}
	})
})

describe('formatZoomUnitLabel', () => {
	it('formats a month range as "Month Year"', () => {
		const [range] = getZoomUnitRanges(new Date('2026-08-01'), new Date('2026-08-31'), 'month')
		expect(formatZoomUnitLabel(range, 'month')).toBe('August 2026')
	})

	it('formats a week range as a date span', () => {
		const [range] = getZoomUnitRanges(new Date('2026-08-16'), new Date('2026-08-31'), 'week')
		expect(formatZoomUnitLabel(range, 'week')).toContain('–')
	})
})

describe('snapDragDays', () => {
	it('rounds to whole days for day zoom', () => {
		expect(snapDragDays('day', new Date('2026-08-18'), 2.4)).toBe(2)
		expect(snapDragDays('day', new Date('2026-08-18'), 2.6)).toBe(3)
	})

	it('rounds to whole weeks for week zoom', () => {
		expect(snapDragDays('week', new Date('2026-08-18'), 10)).toBe(7)
		expect(snapDragDays('week', new Date('2026-08-18'), 4)).toBe(7)
		expect(snapDragDays('week', new Date('2026-08-18'), 3)).toBe(0)
	})

	it('rounds to whole biweeks for biweek zoom', () => {
		expect(snapDragDays('biweek', new Date('2026-08-18'), 20)).toBe(14)
	})

	it('snaps to exact calendar months, handling variable month length', () => {
		// Jan 31 + 1 month should land on the last day of Feb (28 days in 2026), not roll into March.
		const jan31 = new Date('2026-01-31')
		const days = snapDragDays('month', jan31, 30)
		const result = dayjs(jan31).add(days, 'day')
		expect(result.format('YYYY-MM-DD')).toBe('2026-02-28')
	})

	it('returns 0 for sub-threshold month drags', () => {
		expect(snapDragDays('month', new Date('2026-08-18'), 5)).toBe(0)
	})
})

describe('stepZoomUnit', () => {
	it('steps by one day for day zoom', () => {
		const result = stepZoomUnit(new Date('2026-08-18'), 1, 'day')
		expect(dayjs(result).format('YYYY-MM-DD')).toBe('2026-08-19')
	})

	it('steps by seven days for week zoom', () => {
		const result = stepZoomUnit(new Date('2026-08-18'), 1, 'week')
		expect(dayjs(result).format('YYYY-MM-DD')).toBe('2026-08-25')
	})

	it('steps by a calendar month, clamping variable month length', () => {
		const result = stepZoomUnit(new Date('2026-01-31'), 1, 'month')
		expect(dayjs(result).format('YYYY-MM-DD')).toBe('2026-02-28')
	})

	it('steps backwards', () => {
		const result = stepZoomUnit(new Date('2026-08-18'), -1, 'biweek')
		expect(dayjs(result).format('YYYY-MM-DD')).toBe('2026-08-04')
	})
})

describe('getMinDayWidthPixels', () => {
	it('decreases as zoom widens', () => {
		expect(getMinDayWidthPixels('day')).toBeGreaterThan(getMinDayWidthPixels('week'))
		expect(getMinDayWidthPixels('week')).toBeGreaterThan(getMinDayWidthPixels('biweek'))
		expect(getMinDayWidthPixels('biweek')).toBeGreaterThan(getMinDayWidthPixels('month'))
	})
})
