<template>
	<ProjectWrapper
		class="project-gantt"
		:is-loading-project="isLoadingProject"
		:project-id="filters.projectId"
		:view-id
	>
		<template #default>
			<Card :has-content="false">
				<div class="gantt-options">
					<FormField :label="$t('misc.dateRange')">
						<Foo
							id="range"
							ref="flatPickerEl"
							v-model="flatPickerDateRange"
							:config="flatPickerConfig"
							class="input"
							:placeholder="$t('misc.dateRange')"
						/>
					</FormField>
					<FormField
						id="gantt-zoom"
						:label="$t('project.gantt.zoomLevel')"
					>
						<div class="select">
							<select
								id="gantt-zoom"
								v-model="filters.zoom"
							>
								<option value="day">
									{{ $t('project.gantt.day') }}
								</option>
								<option value="week">
									{{ $t('project.gantt.week') }}
								</option>
								<option value="biweek">
									{{ $t('project.gantt.biweek') }}
								</option>
								<option value="month">
									{{ $t('project.gantt.month') }}
								</option>
							</select>
						</div>
					</FormField>
					<FormField
						:label="$t('project.gantt.quickRange')"
						class="quick-range-field"
					>
						<div class="buttons has-addons quick-range-buttons">
							<XButton
								v-for="preset in DATE_RANGE_PRESETS"
								:key="preset.key"
								variant="secondary"
								:class="{'is-active': activePresetKey === preset.key}"
								@click="applyDateRangePreset(preset.key)"
							>
								{{ $t(preset.labelKey) }}
							</XButton>
						</div>
					</FormField>
					<div
						v-if="!hasDefaultFilters"
						class="field"
					>
						<label
							class="label"
							for="range"
						>Reset</label>
						<div class="control">
							<XButton @click="setDefaultFilters">
								Reset
							</XButton>
						</div>
					</div>
					<FancyCheckbox
						v-model="filters.showTasksWithoutDates"
						is-block
					>
						{{ $t('task.show.noDates') }}
					</FancyCheckbox>
				</div>
			</Card>

			<div class="gantt-chart-container">
				<Card
					:has-content="false"
					:padding="false"
					class="has-overflow"
				>
					<GanttChart
						:filters="filters"
						:tasks="tasks"
						:is-loading="isLoading"
						:default-task-start-date="defaultTaskStartDate"
						:default-task-end-date="defaultTaskEndDate"
						@update:task="updateTask"
						@extendRange="applyExtendRange"
					/>
					<TaskForm
						v-if="canWrite"
						@createTask="addGanttTask"
					/>
				</Card>
			</div>
		</template>
	</ProjectWrapper>
</template>

<script setup lang="ts">
import {computed, ref, toRefs} from 'vue'
import type Flatpickr from 'flatpickr'
import {useI18n} from 'vue-i18n'
import type {RouteLocationNormalized} from 'vue-router'
import dayjs from 'dayjs'

import {useBaseStore} from '@/stores/base'
import {useFlatpickrLanguage} from '@/helpers/useFlatpickrLanguage'

import Foo from '@/components/misc/flatpickr/Flatpickr.vue'
import ProjectWrapper from '@/components/project/ProjectWrapper.vue'
import FancyCheckbox from '@/components/input/FancyCheckbox.vue'
import TaskForm from '@/components/tasks/TaskForm.vue'
import FormField from '@/components/input/FormField.vue'

import GanttChart from '@/components/gantt/GanttChart.vue'
import {useGanttFilters} from '../../../views/project/helpers/useGanttFilters'
import {getExtendChunkDays} from '@/helpers/gantt/ganttZoom'
import {PERMISSIONS} from '@/constants/permissions'

import type {DateISO} from '@/types/DateISO'
import type {ITask} from '@/modelTypes/ITask'
import type {IProjectView} from '@/modelTypes/IProjectView'

type Options = Flatpickr.Options.Options

const props = defineProps<{
	isLoadingProject: boolean,
	route: RouteLocationNormalized
	viewId: IProjectView['id']
}>()


const baseStore = useBaseStore()
const canWrite = computed(() => baseStore.currentProject?.maxPermission > PERMISSIONS.READ)

const {route, viewId} = toRefs(props)
const {
	filters,
	hasDefaultFilters,
	setDefaultFilters,
	tasks,
	isLoading,
	addTask,
	updateTask,
} = useGanttFilters(route, viewId)

const DEFAULT_DATE_RANGE_DAYS = 7

const today = new Date()
const defaultTaskStartDate: DateISO = new Date(today.setHours(0, 0, 0, 0)).toISOString()
const defaultTaskEndDate: DateISO = new Date(new Date(
	today.getFullYear(),
	today.getMonth(),
	today.getDate() + DEFAULT_DATE_RANGE_DAYS,
).setHours(23, 59, 0, 0)).toISOString()

async function addGanttTask(title: ITask['title']) {
	return await addTask({
		title,
		projectId: filters.value.projectId,
		startDate: defaultTaskStartDate,
		endDate: defaultTaskEndDate,
	})
}

const flatPickerEl = ref<typeof Foo | null>(null)
const flatPickerDateRange = computed<Date[]>({
	get: () => ([
		new Date(filters.value.dateFrom),
		new Date(filters.value.dateTo),
	]),
	set(newVal) {
		const [dateFrom, dateTo] = newVal.map((date) => date?.toISOString())

		// only set after whole range has been selected
		if (!dateTo) return

		Object.assign(filters.value, {dateFrom, dateTo})
	},
})

type DateRangePresetKey = 'month' | 'quarter' | 'next3Months' | 'year'

const DATE_RANGE_PRESETS: { key: DateRangePresetKey, labelKey: string }[] = [
	{key: 'month', labelKey: 'project.gantt.rangeThisMonth'},
	{key: 'quarter', labelKey: 'project.gantt.rangeThisQuarter'},
	{key: 'next3Months', labelKey: 'project.gantt.rangeNext3Months'},
	{key: 'year', labelKey: 'project.gantt.rangeThisYear'},
]

function getPresetRange(key: DateRangePresetKey): { dateFrom: DateISO, dateTo: DateISO } {
	const now = dayjs()

	switch (key) {
		case 'month':
			return {
				dateFrom: now.startOf('month').toISOString(),
				dateTo: now.endOf('month').toISOString(),
			}
		case 'quarter': {
			const quarterStartMonth = Math.floor(now.month() / 3) * 3
			const start = now.month(quarterStartMonth).startOf('month')
			return {
				dateFrom: start.toISOString(),
				dateTo: start.add(3, 'month').subtract(1, 'day').endOf('day').toISOString(),
			}
		}
		case 'next3Months':
			return {
				dateFrom: now.startOf('day').toISOString(),
				dateTo: now.add(3, 'month').endOf('day').toISOString(),
			}
		case 'year':
			return {
				dateFrom: now.startOf('year').toISOString(),
				dateTo: now.endOf('year').toISOString(),
			}
	}
}

function applyDateRangePreset(key: DateRangePresetKey) {
	Object.assign(filters.value, getPresetRange(key))
}

const activePresetKey = computed<DateRangePresetKey | null>(() => {
	const match = DATE_RANGE_PRESETS.find(({key}) => {
		const range = getPresetRange(key)
		return range.dateFrom === filters.value.dateFrom && range.dateTo === filters.value.dateTo
	})
	return match?.key ?? null
})

function applyExtendRange(direction: 'left' | 'right') {
	const chunkDays = getExtendChunkDays(filters.value.zoom)
	if (direction === 'left') {
		filters.value.dateFrom = dayjs(filters.value.dateFrom).subtract(chunkDays, 'day').toISOString()
	} else {
		filters.value.dateTo = dayjs(filters.value.dateTo).add(chunkDays, 'day').toISOString()
	}
}

const {t} = useI18n({useScope: 'global'})
const flatPickerConfig = computed(() => ({
	altFormat: t('date.altFormatShort'),
	altInput: true,
	defaultDate: [filters.value.dateFrom, filters.value.dateTo],
	enableTime: false,
	mode: 'range',
	locale: useFlatpickrLanguage().value,
} as Options))
</script>

<style lang="scss" scoped>
.gantt-chart-container {
	padding-block-end: 1rem;
	position: relative;
	z-index: 0;
}

.gantt-options {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	align-items: center;
	row-gap: .5rem;
	margin-block-end: 1rem;

	@media screen and (max-width: $tablet) {
		flex-direction: column;
	}
}

.field.quick-range-field {
	inline-size: auto;
	max-inline-size: none;
}

.quick-range-buttons {
	margin-block-end: 0;

	:deep(.button) {
		font-size: .8rem;
	}

	:deep(.button.is-active) {
		background-color: var(--primary);
		border-color: var(--primary);
		color: var(--white);
	}
}

:global(.link-share-view:not(.has-background)) .gantt-options {
	border: none;
	box-shadow: none;

	.card-content {
		padding: .5rem;
	}
}

.field {
	margin-block-end: 0;
	inline-size: 33%;

	&:not(:last-child) {
		padding-inline-end: .5rem;
	}

	@media screen and (max-width: $tablet) {
		inline-size: 100%;
		max-inline-size: 100%;
		margin-block-start: .5rem;
		padding-inline-end: 0 !important;
	}

	&, .input {
		font-size: .8rem;
	}

	.select,
	.select select {
		block-size: auto;
		inline-size: 100%;
		font-size: .8rem;
	}

	.label {
		font-size: .9rem;
	}
}
</style>
