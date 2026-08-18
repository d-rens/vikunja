import { ref } from 'vue'
import {stepZoomUnit, type GanttZoomLevel} from '@/helpers/gantt/ganttZoom'

export type GanttBarDateType = 'both' | 'startOnly' | 'endOnly'

export interface GanttBarModel {
	id: string
	start: Date
	end: Date
	meta?: {
		label?: string
		color?: string
		hasActualDates?: boolean
		dateType?: GanttBarDateType
		isDone?: boolean
		task?: unknown
		isParent?: boolean
		hasDerivedDates?: boolean
		indentLevel?: number
	}
}
export interface UseGanttBarOptions {
	model: GanttBarModel
	timelineStart: Date
	timelineEnd: Date
	zoom?: GanttZoomLevel
	onUpdate?: (id: string, newStart: Date, newEnd: Date) => void
}

export function useGanttBar(options: UseGanttBarOptions) {
	const dragging = ref(false)
	const selected = ref(false)
	const focused = ref(false)

	function onFocus() {
		focused.value = true
	}

	function onBlur() {
		focused.value = false
	}

	function changeSize(direction: 'left' | 'right', modifier: -1 | 1) {
		const zoom = options.zoom ?? 'day'
		let newStart = new Date(options.model.start)
		let newEnd = new Date(options.model.end)

		if (direction === 'left') {
			// Shift+Left: Expand task to the left (move start date earlier)
			newStart = stepZoomUnit(newStart, modifier === 1 ? -1 : 1, zoom)
		} else {
			// Shift+Right: Expand task to the right (move end date later)
			newEnd = stepZoomUnit(newEnd, modifier === 1 ? 1 : -1, zoom)
		}

		// Validate that start is before end (maintain minimum 1 day duration)
		if (newStart < newEnd) {
			options.model.start = newStart
			options.model.end = newEnd

			if (options.onUpdate) {
				options.onUpdate(options.model.id, newStart, newEnd)
			}
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		// task expanding
		if (e.shiftKey) {
			if (e.code === 'ArrowLeft') {
				e.preventDefault()
				changeSize('left', 1)
			}
			if (e.code === 'ArrowRight') {
				e.preventDefault()
				changeSize('right', 1)
			}
		}
		// task shrinking
		else if (e.ctrlKey) {
			if (e.code === 'ArrowLeft') {
				e.preventDefault()
				changeSize('left', -1)
			}
			if (e.code === 'ArrowRight') {
				e.preventDefault()
				changeSize('right', -1)
			}
		}
		// task movement
		else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
			e.preventDefault()

			const zoom = options.zoom ?? 'day'
			const dir = e.code === 'ArrowRight' ? 1 : -1
			const newStart = stepZoomUnit(options.model.start, dir, zoom)
			const newEnd = stepZoomUnit(options.model.end, dir, zoom)

			options.model.start = newStart
			options.model.end = newEnd

			if (options.onUpdate) {
				options.onUpdate(options.model.id, newStart, newEnd)
			}
		}
	}

	return {
		dragging,
		selected,
		focused,
		onFocus,
		onBlur,
		onKeyDown,
	}
}
