import { Component, Input, computed, signal, Signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { CommonModule } from '@angular/common';
import { Project } from './project.interface';
import { DragDropService } from './drag-drop.service';

@Component({
  selector: 'app-project-node',
  standalone: true,
  imports: [MatExpansionModule, CommonModule],
  template: `
    <mat-expansion-panel
      class="project-panel"
      [expanded]="expanded()"
      hideToggle
    >
      <!-- 
        Важно: Отключаем дефолтный клик Material через $event.stopPropagation(), 
        чтобы он не перехватывал управление и не открывал панель раньше времени.
      -->
      <mat-expansion-panel-header
        class="panel-header"
        [class.selected]="isSelected()"
        (mousedown)="onHeaderMouseDown($event)"
        (click)="$event.stopPropagation(); $event.preventDefault()"
        [attr.data-project-id]="project.id"
      >
        <mat-panel-title>{{ project.name }}</mat-panel-title>
      </mat-expansion-panel-header>

      <div class="children-container drop-zone" [attr.data-drop-zone-id]="project.id">
        @for (child of children(); track child.id) {
          <app-project-node
            [project]="child"
            [projectMapSignal]="projectMapSignal"
          />
        }
      </div>
    </mat-expansion-panel>
  `,
  styles: [`
    .project-panel { margin: 4px 0; box-shadow: none !important; border: 1px solid #e0e0e0; }
    .panel-header { cursor: grab; user-select: none; -webkit-user-select: none; transition: background 0.1s; }
    .panel-header:active { cursor: grabbing; }
    .panel-header.selected { background: #b3e5fc !important; }
    .children-container { padding-left: 20px; min-height: 15px; transition: background-color 0.2s ease; }
    
    .drop-zone-active { border: 1px dashed #b0bec5; }
    .drop-allowed { background-color: rgba(76, 175, 80, 0.15) !important; border: 1px dashed #4caf50; }
    .drop-denied { background-color: rgba(244, 67, 54, 0.15) !important; border: 1px dashed #f44336; }
  `]
})
export class ProjectNodeComponent {
  @Input({ required: true }) project!: Project;
  @Input({ required: true }) projectMapSignal!: Signal<Record<string, Project[]>>;

  expanded = signal(false);

  children = computed(() => this.projectMapSignal()[this.project.id] ?? []);
  isSelected = computed(() => this.dragDrop.selectedIds().has(this.project.id));

  constructor(private dragDrop: DragDropService) { }

  onHeaderMouseDown(event: MouseEvent) {
    if (event.button !== 0) return; // Только левая кнопка мыши

    // Передаем в сервис ссылку на функцию переключения развернутого состояния папки.
    // Сервис сам решит: если мышка не двигалась (это клик), он вызовет этот toggle.
    const toggleExpandFn = () => this.expanded.set(!this.expanded());

    this.dragDrop.onHeaderMouseDown(event, this.project.id, toggleExpandFn);
  }
}
