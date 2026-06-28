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
        Добавили (click.meta) и (click.control) с остановкой всплытия, 
        чтобы клик с зажатыми клавишами-модификаторами не долетал до внутренностей Material
      -->
      <mat-expansion-panel-header
        class="panel-header"
        [class.selected]="isSelected()"
        (mousedown)="onHeaderMouseDown($event)"
        (click)="$event.stopPropagation(); $event.preventDefault()"
        (click.control)="$event.stopPropagation(); $event.preventDefault()"
        (click.meta)="$event.stopPropagation(); $event.preventDefault()"
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
    .project-panel { margin: 2px 0; box-shadow: none !important; border: 1px solid #e0e0e0; }
    .panel-header { cursor: grab; user-select: none; -webkit-user-select: none; position: relative; }
    .panel-header:active { cursor: grabbing; }
    .panel-header.selected { background: #b3e5fc !important; }
    
    .children-container { padding-left: 20px; min-height: 12px; transition: background-color 0.15s; }
    
    .children-container.drop-inside {
      background-color: rgba(76, 175, 80, 0.15) !important; border: 1px dashed #4caf50;
    }

    .panel-header.drop-before::before {
      content: ""; position: absolute; left: 0; right: 0; top: 0; height: 4px; background: #4caf50; z-index: 10;
    }
    .panel-header.drop-after::after {
      content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: #4caf50; z-index: 10;
    }
    .panel-header.drop-inside {
      background-color: rgba(76, 175, 80, 0.2) !important; border: 1px dashed #4caf50;
    }
    .panel-header.drop-denied, .children-container.drop-denied {
      background-color: rgba(244, 67, 54, 0.15) !important;
    }
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
    if (event.button !== 0) return;

    // Передаем коллбек управления открытием/закрытием
    const toggleExpandFn = () => this.expanded.set(!this.expanded());
    this.dragDrop.onHeaderMouseDown(event, this.project.id, toggleExpandFn);
  }
}