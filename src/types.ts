// 공통 타입 정의

// 1. 미디어 파일 구조 (실제 수집된 데이터 기반)
export interface MediaFile {
  id: number;
  access_key: string;
  original_file_name: string;
  file_size: number;
  width: number;
  height: number;
  original: string; // 원본 URL
  large: string; // 큰 이미지 URL
  small: string; // 작은 이미지 URL
  small_resize: string; // 작은 리사이즈 URL
  large_resize: string; // 큰 리사이즈 URL
}

// 3-1. 비디오 파일 구조 (이미지와 CDN 필드 다름)
export interface VideoFile {
  id: number;
  access_key: string;
  original_file_name: string;
  file_size: number;
  source_type: string;
  high: string; // 고화질 MP4 URL
  low: string; // 저화질 MP4 URL
  preview: string; // 프리뷰 이미지 URL
  preview_small: string;
  duration: number; // 재생 시간 (초)
}

// 4. 작성자 정보
export interface Author {
  id: number;
  type: string; // 'parent', 'teacher' 등
  name: string;
  picture: MediaFile | null;
  username: string;
}

// 5. 알림장 API 응답 구조
export interface ReportsApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ReportItem[];
}

export interface ReportItem {
  id: number;
  created: string; // ISO8601, UTC
  modified: string;
  date_written: string; // YYYY-MM-DD — 실제 작성 날짜 (created와 다를 수 있음)
  author: Author;
  author_name: string; // 예: "햇님반 교사", "김지안 엄마"
  center: number; // 어린이집 ID
  cls: number; // 반 ID
  class_name: string; // 예: "햇님반"
  child: number; // 자녀 ID
  child_name: string;
  child_picture: MediaFile | null;
  /**
   * true  = 원 → 가정 (선생님이 부모에게 보낸 알림장)
   * false = 가정 → 원 (부모가 선생님에게 보낸 알림장)
   */
  is_sent_from_center: boolean;
  content: string; // 대부분 plain text, 일부 HTML 혼재
  weather: string | null; // 날씨 정보 (선생님 작성 시 포함)
  activity_rate: number | null; // 활동 참여율
  num_comments: number;
  read_by_me: boolean;
  read_by_parent: boolean;
  attached_images: MediaFile[];
  attached_videos: VideoFile[];
  attached_files: unknown[]; // 기타 파일 첨부 (이미지·비디오 외)
  thumbnail: MediaFile | null; // 대표 썸네일
}

export interface DailyReportEntry {
  date: string;
  items: ReportItem[];
}

export interface NoticeItem {
  id: number;
  created: string;
  modified: string;
  title: string;
  content: string;
  author_name: string;
  attached_images: unknown[];
  attached_files: unknown[];
}

export interface NoticesApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: NoticeItem[];
}

export interface DailyNoticeEntry {
  date: string;
  items: NoticeItem[];
}

// 6. 앨범 API 응답 구조
export interface AlbumsApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AlbumItem[];
}

export interface AlbumItem {
  id: number;
  created: string;
  modified: string;
  author: Author;
  author_name: string;
  center: number;
  title: string;
  content: string;
  show_on_homepage: boolean;
  portrait_right: boolean;
  num_comments: number;
  attached_images: MediaFile[];
  attached_videos: VideoFile[];
}

// 7. 스크래핑 설정
export interface ScrapingConfig {
  username: string;
  password: string;
  outputDir: string;
}

// 8. 아카이빙 관련 타입

/** frontmatter의 sources 항목 */
export interface ArchiveSource {
  type: 'report' | 'album';
  id: number;
}

/** frontmatter의 media 항목 — 로컬 파일명 + CDN URL 전체 */
export interface ArchiveMediaEntry {
  /** 로컬 파일명: YYYY-MM-DD-{img|video}-{id}.ext */
  file: string;
  cdn: {
    original?: string;
    large?: string;
    small?: string;
    small_resize?: string;
    large_resize?: string;
    high?: string;
    low?: string;
    preview?: string;
    preview_small?: string;
    duration?: number;
  };
}

/** archive/daily/*.md 의 frontmatter 구조 */
export interface DailyArchiveFrontmatter {
  date: string; // YYYY-MM-DD
  tags: string[]; // 최소 YYYY-MM 포함
  sources: ArchiveSource[];
  media: ArchiveMediaEntry[];
}
