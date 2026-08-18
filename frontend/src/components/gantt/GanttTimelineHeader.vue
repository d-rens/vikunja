<template>
	<div
		class="gantt-timeline"
		role="columnheader"
		:aria-label="$t('project.gantt.timelineHeader')"
	>
		<!-- Upper timeunit for months (redundant with the lower row at month zoom) -->
		<div
			v-if="zoom !== 'month'"
			class="gantt-timeline-months"
			role="row"
			:aria-label="$t('project.gantt.monthsRow')"
		>
			<div
				v-for="monthGroup in monthGroups"
				:key="monthGroup.key"
				class="timeunit-month"
				:style="{ width: `${monthGroup.width}px` }"
				role="columnheader"
				:aria-label="$t('project.gantt.monthLabel', {month: monthGroup.label})"
			>
				{{ monthGroup.label }}
			</div>
		</div>

		<!-- Lower timeunit for days -->
		<div
			v-if="zoom === 'day'"
			class="gantt-timeline-days"
			role="row"
			:aria-label="$t('project.gantt.daysRow')"
		>
			<div
				v-for="date in timelineData"
				:key="date.toISOString()"
				class="timeunit"
				:style="{ width: `${dayWidthPixels}px` }"
				role="columnheader"
				:aria-label="dateIsToday(date)
					? $t('project.gantt.dayLabelToday', {
						date: date.toLocaleDateString(),
						weekday: weekDayFromDate(date)
					})
					: $t('project.gantt.dayLabel', {
						date: date.toLocaleDateString(),
						weekday: weekDayFromDate(date)
					})"
			>
				<div
					class="timeunit-wrapper"
					:class="{'today': dateIsToday(date)}"
				>
					<span>{{ date.getDate() }}</span>
					<span class="weekday">
						{{ weekDayFromDate(date) }}
					</span>
				</div>
			</div>
		</div>

		<!-- Lower timeunit for week/biweek/month zoom -->
		<div
			v-else
			class="gantt-timeline-days gantt-timeline-periods"
			role="row"
			:aria-label="$t('project.gantt.periodsRow')"
		>
			<div
				v-for="range in zoomRanges"
				:key="range.start.toISOString()"
				class="timeunit"
				:style="{ width: `${range.days * dayWidthPixels}px` }"
				role="columnheader"
				:aria-label="rangeIsToday(range)
					? $t('project.gantt.periodLabelToday', {period: formatZoomUnitLabel(range, zoom)})
					: $t('project.gantt.periodLabel', {period: formatZoomUnitLabel(range, zoom)})"
			>
				<div
					class="timeunit-wrapper"
					:class="{'today': rangeIsToday(range)}"
				>
					<span>{{ formatZoomUnitLabel(range, zoom) }}</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import {useGlobalNow} from '@/composables/useGlobalNow'
import {useWeekDayFromDate} from '@/helpers/time/formatDate'
import dayjs from 'dayjs'

import {formatZoomUnitLabel, type GanttZoomLevel, type GanttZoomRange} from '@/helpers/gantt/ganttZoom'

const props = defineProps<{
    timelineData: Date[]
    dayWidthPixels: number
    zoom: GanttZoomLevel
    zoomRanges: GanttZoomRange[]
}>()

const weekDayFromDate = useWeekDayFromDate()
const { now: today } = useGlobalNow()

const dateIsToday = computed(() => {
	const todayStr = today.value.toDateString()
	return (date: Date) => date.toDateString() === todayStr
})

const rangeIsToday = computed(() => {
	const now = today.value.getTime()
	return (range: GanttZoomRange) => now >= range.start.getTime() && now < range.end.getTime()
})

const monthGroups = computed(() => {
	const groups = props.timelineData.reduce(
		(groups, date) => {
			const month = date.getMonth()
			const year = date.getFullYear()
			const key = `${year}-${month}`

			const lastGroup = groups[groups.length - 1]
			if (lastGroup?.key === key) {
				lastGroup.width += props.dayWidthPixels
			} else {
				groups.push({
					key,
					label: dayjs(date).format('MMMM YYYY'),
					width: props.dayWidthPixels,
				})
			}

			return groups
		},
		[] as Array<{key: string; label: string; width: number}>,
	)

	return groups
})
</script>

<style scoped lang="scss">
.gantt-timeline {
	background: var(--white);
	border-block-end: 1px solid var(--grey-200);
	position: sticky;
	inset-block-start: 0;
	z-index: 10;
}

.gantt-timeline-months {
	display: flex;

	.timeunit-month {
		background: var(--white);
		font-family: $vikunja-font;
		font-weight: bold;
		border-inline-end: 1px solid var(--grey-200);
		padding: 0.5rem 0;
		text-align: center;
		font-size: 1rem;
		color: var(--grey-800);
	}
}

.gantt-timeline-days {
	display: flex;

	.timeunit {
		.timeunit-wrapper {
			padding: 0.5rem 0;
			font-size: 1rem;
			display: flex;
			flex-direction: column;
			align-items: center;
			inline-size: 100%;
			font-family: $vikunja-font;

			&.today {
				background: var(--primary);
				color: var(--white);
				border-radius: 5px 5px 0 0;
				font-weight: bold;
			}

			.weekday {
				font-size: 0.8rem;
			}
		}
	}
}

.gantt-timeline-periods {
	.timeunit-wrapper span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-inline-size: 100%;
		padding-inline: 0.25rem;
	}
}
</style>
